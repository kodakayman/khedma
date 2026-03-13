import { Connection, PublicKey } from "@solana/web3.js";
import { Logger } from "pino";
import { LaunchCallback, LaunchMonitor } from "./launch-monitor.js";
import { BatchedSignatureParser } from "./event-parser.js";

export class PumpfunLaunchMonitor implements LaunchMonitor {
  public readonly source = "pumpfun" as const;
  private subscriptionId: number | null = null;
  private processedCount = 0;

  public constructor(
    private readonly connection: Connection,
    private readonly pumpfunProgramId: PublicKey,
    private readonly parser: BatchedSignatureParser,
    private readonly logger: Logger
  ) {}

  public async start(callback: LaunchCallback): Promise<void> {
    if (this.subscriptionId !== null) {
      return;
    }

    // Process only 1 in every 50 events to avoid rate limits (very conservative for free RPC)
    const SAMPLE_RATE = 50;

    this.subscriptionId = this.connection.onLogs(this.pumpfunProgramId, async (logs, context) => {
      if (logs.err) {
        return;
      }

      const looksLikeCreate = logs.logs.some((line) => {
        const text = line.toLowerCase();
        return text.includes("create") || text.includes("initialize");
      });

      if (!looksLikeCreate) {
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
        this.logger.error({ error, signature: logs.signature }, "pump.fun event parse failure");
      }
    }, "confirmed");

    this.logger.info({ programId: this.pumpfunProgramId.toBase58() }, "pump.fun monitor started");
  }

  public async stop(): Promise<void> {
    if (this.subscriptionId === null) {
      return;
    }

    await this.connection.removeOnLogsListener(this.subscriptionId);
    this.logger.info("pump.fun monitor stopped");
    this.subscriptionId = null;
  }
}
