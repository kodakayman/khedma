import { Commitment, Connection } from "@solana/web3.js";
import { Logger } from "pino";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error).toLowerCase();
}

export function isRateLimitError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("request limit") ||
    message.includes("max rate limit")
  );
}

export function isTimeoutError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("timeout") ||
    message.includes("exceeded") ||
    message.includes("timed out") ||
    message.includes("etimedout")
  );
}

export interface RpcPoolOptions {
  commitment?: Commitment;
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  rateLimitCooldownMs: number;
  /** Enable request batching for getMultipleAccounts */
  enableBatching?: boolean;
  /** Maximum accounts per batch request */
  batchMaxSize?: number;
}

export interface RpcEndpointConfig {
  rpcUrl: string;
  wsUrl?: string;
}

interface RpcEndpointState {
  rpcUrl: string;
  wsUrl?: string;
  connection: Connection;
  nextAvailableAt: number;
  rateLimitHits: number;
  totalCalls: number;
  errors: number;
  latencyMs: number;
}

export interface RpcPoolStats {
  calls: number;
  retries: number;
  rateLimitHits: number;
  endpointFailures: number;
  timeouts: number;
  endpoints: Array<{
    rpcUrl: string;
    nextAvailableAt: number;
    totalCalls: number;
    rateLimitHits: number;
    errors: number;
    avgLatencyMs: number;
  }>;
}

interface BatchRequest<T> {
  id: string;
  task: (connection: Connection) => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  addedAt: number;
}

export class ResilientRpcPool {
  private readonly endpoints: RpcEndpointState[];
  private endpointCursor = 0;

  private calls = 0;
  private retries = 0;
  private rateLimitHits = 0;
  private endpointFailures = 0;
  private timeouts = 0;

  // Request batching for multiple account queries
  private readonly batchRequests = new Map<string, BatchRequest<unknown>[]>();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchMaxSize: number;
  private readonly batchWindowMs = 50; // Small window for fast response

  public constructor(
    configs: RpcEndpointConfig[],
    private readonly options: RpcPoolOptions,
    private readonly logger: Logger
  ) {
    if (configs.length === 0) {
      throw new Error("ResilientRpcPool requires at least one endpoint");
    }

    const commitment = options.commitment ?? "confirmed";
    this.batchMaxSize = options.batchMaxSize ?? 100;

    this.endpoints = configs.map((config) => ({
      rpcUrl: config.rpcUrl,
      wsUrl: config.wsUrl,
      connection: new Connection(config.rpcUrl, {
        wsEndpoint: config.wsUrl,
        commitment
      }),
      nextAvailableAt: 0,
      rateLimitHits: 0,
      totalCalls: 0,
      errors: 0,
      latencyMs: 0
    }));

    this.startBatchProcessor();
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processBatches().catch((error) => {
        this.logger.error({ error }, "batch processing failed");
      });
    }, this.batchWindowMs);
  }

  private async processBatches(): Promise<void> {
    if (this.batchRequests.size === 0) return;

    for (const [batchKey, requests] of this.batchRequests) {
      if (requests.length === 0) continue;

      const endpoint = await this.pickEndpoint();
      const tasks = requests.map(r => r.task);

      try {
        // Execute all tasks in parallel on same connection
        const results = await Promise.allSettled(
          tasks.map(task => task(endpoint.connection))
        );

        results.forEach((result, i) => {
          if (result.status === "fulfilled") {
            requests[i].resolve(result.value);
          } else {
            requests[i].reject(result.reason);
          }
        });
      } catch (error) {
        requests.forEach(req => req.reject(error));
      }

      this.batchRequests.delete(batchKey);
    }
  }

  public get primaryConnection(): Connection {
    return this.endpoints[0].connection;
  }

  public getStats(): RpcPoolStats {
    return {
      calls: this.calls,
      retries: this.retries,
      rateLimitHits: this.rateLimitHits,
      endpointFailures: this.endpointFailures,
      timeouts: this.timeouts,
      endpoints: this.endpoints.map((endpoint) => ({
        rpcUrl: endpoint.rpcUrl,
        nextAvailableAt: endpoint.nextAvailableAt,
        totalCalls: endpoint.totalCalls,
        rateLimitHits: endpoint.rateLimitHits,
        errors: endpoint.errors,
        avgLatencyMs: endpoint.latencyMs
      }))
    };
  }

  public async call<T>(
    operation: string,
    task: (connection: Connection) => Promise<T>,
    retriesOverride?: number,
    timeoutMs?: number
  ): Promise<T> {
    const maxRetries = retriesOverride ?? this.options.maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const endpoint = await this.pickEndpoint();
      endpoint.totalCalls += 1;
      this.calls += 1;

      const startTime = Date.now();

      try {
        const result = timeoutMs
          ? await this.callWithTimeout(task(endpoint.connection), timeoutMs)
          : await task(endpoint.connection);

        // Update latency tracking
        const latency = Date.now() - startTime;
        endpoint.latencyMs = endpoint.latencyMs * 0.9 + latency * 0.1; // EMA

        return result;
      } catch (error) {
        lastError = error;
        endpoint.errors += 1;

        if (isRateLimitError(error)) {
          endpoint.rateLimitHits += 1;
          this.rateLimitHits += 1;
          const cooldown = this.options.rateLimitCooldownMs * (attempt + 1);
          endpoint.nextAvailableAt = Date.now() + cooldown;
          this.logger.warn({ operation, endpoint: endpoint.rpcUrl, cooldown }, "rpc rate limit detected");
        } else if (isTimeoutError(error)) {
          this.timeouts += 1;
          this.logger.warn({ operation, endpoint: endpoint.rpcUrl, attempt }, "rpc timeout");
        }

        if (attempt === maxRetries) {
          break;
        }

        this.retries += 1;
        this.endpointFailures += 1;
        const base = this.options.baseBackoffMs * Math.pow(2, attempt);
        const capped = Math.min(base, this.options.maxBackoffMs);
        const jitter = Math.floor(Math.random() * Math.max(30, Math.floor(capped / 3)));
        const waitMs = capped + jitter;
        await sleep(waitMs);
      }
    }

    throw new Error(`RPC operation '${operation}' failed after retries: ${String(lastError)}`);
  }

  private callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Batch multiple account fetches into a single RPC call for efficiency
   */
  public async getMultipleAccounts<T>(
    pubkeys: string[],
    task: (connection: Connection, pubkeys: string[]) => Promise<T[]>
  ): Promise<T[]> {
    if (pubkeys.length === 0) return [];
    if (pubkeys.length === 1) {
      const result = await task(this.primaryConnection, pubkeys);
      return result;
    }

    // For small batches, just call directly
    if (pubkeys.length <= 5) {
      return this.call("getMultipleAccounts", (conn) => task(conn, pubkeys));
    }

    // Split into chunks for large batches
    const chunks: string[][] = [];
    for (let i = 0; i < pubkeys.length; i += this.batchMaxSize) {
      chunks.push(pubkeys.slice(i, i + this.batchMaxSize));
    }

    const results = await Promise.all(
      chunks.map(chunk => this.call("getMultipleAccountsChunk", (conn) => task(conn, chunk)))
    );

    return results.flat();
  }

  private async pickEndpoint(): Promise<RpcEndpointState> {
    const now = Date.now();
    let bestIndex = 0;
    let bestScore = Number.MAX_SAFE_INTEGER;

    // Pick the healthiest endpoint with lowest latency
    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      if (endpoint.nextAvailableAt > now) continue;

      // Score: lower is better - prioritize low latency, low error rate
      const errorRate = endpoint.totalCalls > 0 ? endpoint.errors / endpoint.totalCalls : 0;
      const score = endpoint.latencyMs + (errorRate * 1000);

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const candidate = this.endpoints[bestIndex];

    if (candidate.nextAvailableAt > now) {
      // All endpoints are rate limited, wait for the earliest
      const waitMs = candidate.nextAvailableAt - now;
      await sleep(waitMs);
    }

    this.endpointCursor = (bestIndex + 1) % this.endpoints.length;
    return candidate;
  }

  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.batchRequests.clear();
  }
}
