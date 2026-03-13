import { Connection, PublicKey } from "@solana/web3.js";
import { Logger } from "pino";
import { LaunchCallback, LaunchMonitor } from "./launch-monitor.js";
import { BatchedSignatureParser } from "./event-parser.js";

export class RaydiumLaunchMonitor implements LaunchMonitor {
  public readonly source = "raydium" as const;
  private subscriptionId: number | null = null;
  private processedCount = 0;

  public constructor(
    private readonly connection: Connection,
    private readonly raydiumProgramId: PublicKey,
    private readonly parser: BatchedSignatureParser,
    private readonly logger: Logger
  ) {}

  public async start(callback: LaunchCallback): Promise<void> {
    if (this.subscriptionId !== null) {
      return;
    }

    // Process only 1 in every 50 events to avoid rate limits (very conservative for free RPC)
    const SAMPLE_RATE = 50;

    this.subscriptionId = this.connection.onLogs(this.raydiumProgramId, async (logs, context) => {
      if (logs.err) {
        return;
      }

      const looksLikeLaunch = logs.logs.some((line) => {
        const text = line.toLowerCase();
        return text.includes("initialize") || text.includes("init_pc_amount");
      });

      if (!looksLikeLaunch) {
        return;
      }

      // Rate limit: only process a fraction of events
      this.processedCount++;
      if (this.processedCount % SAMPLE_RATE !== 0) {
        return;
      }

      try {
        const mint = await this.parser.resolveMint(logs.signature);
        if (!mint) {
          return;
        }

        await callback({
          source: this.source,
          mint,
          signature: logs.signature,
          slot: context.slot,
          discoveredAt: Date.now()
        });
      } catch (error) {
        this.logger.error({ error, signature: logs.signature }, "raydium event parse failure");
      }
    }, "confirmed");

    this.logger.info({ programId: this.raydiumProgramId.toBase58() }, "raydium monitor started");
  }

  public async stop(): Promise<void> {
    if (this.subscriptionId === null) {
      return;
    }

    await this.connection.removeOnLogsListener(this.subscriptionId);
    this.logger.info("raydium monitor stopped");
    this.subscriptionId = null;
  }
}
