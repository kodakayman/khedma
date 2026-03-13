import { ParsedTransactionWithMeta } from "@solana/web3.js";
import { Logger } from "pino";
import { ResilientRpcPool } from "../solana/rpc-pool.js";

const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

// Fast cache with LRU eviction - using Map with size limit
const MAX_CACHE_SIZE = 50_000;

interface PendingRequest {
  promise: Promise<string | undefined>;
  resolve: (value: string | undefined) => void;
}

export interface SignatureParserOptions {
  batchSize: number;
  batchWindowMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownMs: number;
}

export interface SignatureParserStats {
  queuedRequests: number;
  cacheHits: number;
  batches: number;
  parseFailures: number;
  circuitOpenSkips: number;
  totalProcessed: number;
}

/**
 * Fast LRU cache implementation for signatures
 */
class LruCache<T> {
  private cache = new Map<string, T>();

  constructor(private maxSize: number) {}

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    // Delete if exists (to update position)
    this.cache.delete(key);
    // Add to end
    this.cache.set(key, value);
    // Evict oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

export class BatchedSignatureParser {
  // Use LRU cache for better memory management
  private readonly signatureCache = new LruCache<string | undefined>(MAX_CACHE_SIZE);
  private readonly pending = new Map<string, PendingRequest>();
  private readonly queue: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  private stats: SignatureParserStats = {
    queuedRequests: 0,
    cacheHits: 0,
    batches: 0,
    parseFailures: 0,
    circuitOpenSkips: 0,
    totalProcessed: 0
  };

  public constructor(
    private readonly rpcPool: ResilientRpcPool,
    private readonly logger: Logger,
    private readonly options: SignatureParserOptions,
    private readonly heliusEnhancedApi?: string
  ) {}

  public getStats(): SignatureParserStats {
    return {
      ...this.stats,
      queuedRequests: this.queue.length
    };
  }

  public async resolveMint(signature: string): Promise<string | undefined> {
    // Fast path: check cache first
    const cached = this.signatureCache.get(signature);
    if (cached !== undefined) {
      this.stats.cacheHits += 1;
      return cached;
    }

    // Circuit breaker check
    if (Date.now() < this.circuitOpenUntil) {
      this.stats.circuitOpenSkips += 1;
      return undefined;
    }

    // Check if already pending
    const existing = this.pending.get(signature);
    if (existing) {
      return existing.promise;
    }

    let resolveRef: (value: string | undefined) => void = () => undefined;
    const promise = new Promise<string | undefined>((resolve) => {
      resolveRef = resolve;
    });

    this.pending.set(signature, {
      promise,
      resolve: resolveRef
    });

    this.queue.push(signature);
    this.scheduleFlush();

    return promise;
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushQueue().catch((error) => {
        this.logger.error({ error }, "signature parser flush failed");
      });
    }, this.options.batchWindowMs);
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.options.batchSize);
    this.stats.batches += 1;
    this.stats.totalProcessed += batch.length;

    try {
      let transactions: (ParsedTransactionWithMeta | null)[];

      // Use Helius enhanced API if available (faster)
      if (this.heliusEnhancedApi) {
        transactions = await this.fetchViaHeliusEnhanced(batch);
      } else {
        // Fall back to standard RPC - use batching for multiple txs
        transactions = await this.fetchViaStandardRpc(batch);
      }

      for (let i = 0; i < batch.length; i += 1) {
        const signature = batch[i];
        const tx = transactions[i] ?? null;
        const mint = tx ? this.extractMint(tx) : undefined;
        this.resolvePending(signature, mint);
      }

      this.consecutiveFailures = 0;
    } catch (error) {
      this.stats.parseFailures += batch.length;
      this.consecutiveFailures += batch.length;

      if (this.consecutiveFailures >= this.options.circuitBreakerThreshold) {
        this.circuitOpenUntil = Date.now() + this.options.circuitBreakerCooldownMs;
        this.logger.warn(
          {
            failures: this.consecutiveFailures,
            cooldownMs: this.options.circuitBreakerCooldownMs
          },
          "signature parser circuit breaker opened"
        );
        this.consecutiveFailures = 0;
      }

      for (const signature of batch) {
        this.resolvePending(signature, undefined);
      }
    }

    // Continue processing if more items in queue
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }

  private async fetchViaStandardRpc(signatures: string[]): Promise<(ParsedTransactionWithMeta | null)[]> {
    // Fetch in smaller batches to avoid timeouts
    const BATCH_CHUNK = 25;
    const results: (ParsedTransactionWithMeta | null)[] = [];

    for (let i = 0; i < signatures.length; i += BATCH_CHUNK) {
      const chunk = signatures.slice(i, i + BATCH_CHUNK);
      const chunkResults = await this.rpcPool.call(
        "getParsedTransactions",
        (connection) => connection.getParsedTransactions(chunk, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed"
        }),
        2, // fewer retries for batch
        5000 // 5s timeout
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private async fetchViaHeliusEnhanced(signatures: string[]): Promise<(ParsedTransactionWithMeta | null)[]> {
    // Helius enhanced transactions API: POST to /v0/transactions/
    const url = this.heliusEnhancedApi!.replace(/\/$/, "") + "/";

    // Process in chunks to avoid payload size limits
    const CHUNK_SIZE = 100;
    const results: (ParsedTransactionWithMeta | null)[] = [];

    for (let i = 0; i < signatures.length; i += CHUNK_SIZE) {
      const chunk = signatures.slice(i, i + CHUNK_SIZE);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: chunk,
          encoding: "jsonParsed",
          commitment: "confirmed"
        })
      });

      if (!response.ok) {
        throw new Error(`Helius enhanced API failed: ${response.status}`);
      }

      const data = (await response.json()) as Array<{
        transaction?: { meta?: { postTokenBalances?: Array<{ mint: string }> } };
      }>;

      // Convert Helius format to standard format
      const chunkResults = data.map((item) => {
        if (!item.transaction?.meta?.postTokenBalances) {
          return null;
        }
        return {
          meta: {
            postTokenBalances: item.transaction.meta.postTokenBalances.map(b => ({ mint: b.mint }))
          }
        } as ParsedTransactionWithMeta;
      });

      results.push(...chunkResults);
    }

    return results;
  }

  private extractMint(tx: ParsedTransactionWithMeta): string | undefined {
    // Fast path: check post balances first (usually has the mint)
    const postBalances = tx.meta?.postTokenBalances;
    if (postBalances && postBalances.length > 0) {
      for (const balance of postBalances) {
        if (balance.mint && balance.mint !== NATIVE_SOL_MINT) {
          return balance.mint;
        }
      }
    }

    // Fallback to pre balances
    const preBalances = tx.meta?.preTokenBalances;
    if (preBalances && preBalances.length > 0) {
      for (const balance of preBalances) {
        if (balance.mint && balance.mint !== NATIVE_SOL_MINT) {
          return balance.mint;
        }
      }
    }

    return undefined;
  }

  private resolvePending(signature: string, mint: string | undefined): void {
    this.signatureCache.set(signature, mint);

    const pending = this.pending.get(signature);
    if (!pending) {
      return;
    }

    pending.resolve(mint);
    this.pending.delete(signature);
  }

  /**
   * Clear old cache entries to free memory
   */
  public clearCache(): void {
    this.signatureCache.clear();
    this.logger.info("signature cache cleared");
  }
}
