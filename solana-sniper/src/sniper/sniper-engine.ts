import { Logger } from "pino";
import { TokenIntelligenceService } from "../intelligence/token-intelligence.js";
import { BatchedSignatureParser } from "../monitor/event-parser.js";
import { LaunchMonitor } from "../monitor/launch-monitor.js";
import { Notifier } from "../notifications/notifier.js";
import { PositionManager } from "../position/position-manager.js";
import { ResilientRpcPool } from "../solana/rpc-pool.js";
import { EngineStats, LaunchEvent, Position, SnipeParameters } from "../types.js";
import { TradeExecutor } from "./trade-executor.js";

export class SniperEngine {
  private started = false;
  // Use Set for O(1) lookups
  private readonly seenMints = new Set<string>();
  private queue: Promise<void> = Promise.resolve();
  private autoSellTimer: NodeJS.Timeout | null = null;

  private readonly stats: EngineStats = {
    totalEvents: 0,
    parseFailures: 0,
    filteredEvents: 0,
    buyAttempts: 0,
    buySuccess: 0,
    sellAttempts: 0,
    sellSuccess: 0
  };

  // Track last notification times to avoid spam
  private readonly lastNotificationTime = new Map<string, number>();
  private readonly notificationThrottleMs = 60_000; // 1 minute between notifications for same mint

  public constructor(
    private readonly monitors: LaunchMonitor[],
    private readonly executor: TradeExecutor,
    private readonly intelligence: TokenIntelligenceService,
    private readonly positionManager: PositionManager,
    private readonly notifier: Notifier,
    private readonly rpcPool: ResilientRpcPool,
    private readonly parser: BatchedSignatureParser,
    private readonly logger: Logger,
    private params: SnipeParameters
  ) {}

  public updateParams(params: SnipeParameters): void {
    this.params = params;
    this.logger.info({ params }, "snipe parameters updated");

    if (this.started) {
      this.startAutoSellLoop();
    }
  }

  public getParams(): SnipeParameters {
    return this.params;
  }

  public isRunning(): boolean {
    return this.started;
  }

  public listPositions(): Position[] {
    return this.positionManager.list();
  }

  public getStatus(): Record<string, unknown> {
    return {
      running: this.started,
      stats: { ...this.stats },
      seenMintsCount: this.seenMints.size,
      openPositions: this.positionManager.count(),
      rpc: this.rpcPool.getStats(),
      parser: this.parser.getStats()
    };
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    // Start all monitors in parallel
    await Promise.all(
      this.monitors.map((monitor) => monitor.start(async (event) => {
        this.enqueueEvent(event);
      }))
    );

    this.started = true;
    this.startAutoSellLoop();
    this.logger.info("sniper engine started");
  }

  public async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    if (this.autoSellTimer) {
      clearInterval(this.autoSellTimer);
      this.autoSellTimer = null;
    }

    // Stop all monitors
    await Promise.allSettled(
      this.monitors.map((monitor) => monitor.stop())
    );

    this.started = false;

    if (this.params.persistPositions) {
      await this.positionManager.saveToDisk();
    }

    // Clear seen mints on stop to allow reprocessing on restart
    this.seenMints.clear();

    this.logger.info("sniper engine stopped");
  }

  public async manualSellByMint(mint: string): Promise<{ sold: number; attempted: number; errors: string[] }> {
    const candidates = this.positionManager.getByMint(mint);

    if (candidates.length === 0) {
      for (const wallet of this.executor.listWallets()) {
        try {
          const balanceRaw = await this.executor.getWalletTokenBalance(wallet, mint);
          if (BigInt(balanceRaw) <= 0n) {
            continue;
          }

          candidates.push({
            mint,
            source: "pumpfun",
            wallet,
            openedAt: Date.now(),
            amountInSol: 0,
            tokenAmountRaw: balanceRaw
          });
        } catch (error) {
          this.logger.debug({ error, wallet, mint }, "failed to get wallet balance");
        }
      }
    }

    let sold = 0;
    let attempted = 0;
    const errors: string[] = [];

    for (const position of candidates) {
      attempted += 1;
      try {
        const outcome = await this.sellPosition(position, "manual");
        if (outcome.success) {
          sold += 1;
        } else if (outcome.reason) {
          errors.push(`${position.wallet}:${outcome.reason}`);
        }
      } catch (error) {
        errors.push(`${position.wallet}:${String(error)}`);
      }
    }

    return { sold, attempted, errors };
  }

  private startAutoSellLoop(): void {
    if (this.autoSellTimer) {
      clearInterval(this.autoSellTimer);
      this.autoSellTimer = null;
    }

    if (!this.params.autoSell) {
      return;
    }

    this.autoSellTimer = setInterval(() => {
      this.runAutoSellChecks().catch((error) => {
        this.logger.error({ error }, "auto-sell loop failed");
      });
    }, this.params.positionCheckIntervalMs);
  }

  private async runAutoSellChecks(): Promise<void> {
    const openPositions = this.positionManager.list();

    for (const position of openPositions) {
      try {
        const snapshot = await this.intelligence.fetchMarketSnapshot(position.mint);
        const updated = this.positionManager.update(position.wallet, position.mint, {
          currentPriceUsd: snapshot.priceUsd,
          currentMarketCapUsd: snapshot.marketCapUsd
        });

        if (!updated) {
          continue;
        }

        const movePct = this.calculateMovePct(updated, snapshot.priceUsd, snapshot.marketCapUsd);
        if (movePct === undefined) {
          continue;
        }

        if (movePct >= this.params.takeProfitPct) {
          await this.sellPosition(updated, `take-profit ${movePct.toFixed(2)}%`);
        } else if (movePct <= -this.params.stopLossPct) {
          await this.sellPosition(updated, `stop-loss ${movePct.toFixed(2)}%`);
        }
      } catch (error) {
        this.logger.debug({ error, position: position.mint }, "auto-sell check failed for position");
      }
    }

    if (this.params.persistPositions) {
      await this.positionManager.saveToDisk();
    }
  }

  private calculateMovePct(position: Position, priceUsd?: number, marketCapUsd?: number): number | undefined {
    if (position.entryPriceUsd !== undefined && priceUsd !== undefined && position.entryPriceUsd > 0) {
      return ((priceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;
    }

    if (position.entryMarketCapUsd !== undefined && marketCapUsd !== undefined && position.entryMarketCapUsd > 0) {
      return ((marketCapUsd - position.entryMarketCapUsd) / position.entryMarketCapUsd) * 100;
    }

    return undefined;
  }

  private enqueueEvent(event: LaunchEvent): void {
    // Fire and forget - don't block the monitor
    this.queue = this.queue.then(async () => {
      await this.handleEvent(event);
    }).catch((error) => {
      this.logger.error({ error }, "event queue failure");
    });
  }

  private async handleEvent(event: LaunchEvent): Promise<void> {
    this.stats.totalEvents += 1;

    // Fast path: check if already seen
    if (this.seenMints.has(event.mint)) {
      return;
    }

    // Mark as seen immediately to prevent duplicates
    this.seenMints.add(event.mint);

    // Early eligibility check before expensive enrichment
    if (!this.isQuickEligible(event)) {
      this.stats.filteredEvents += 1;
      return;
    }

    let enriched = event;
    try {
      enriched = await this.intelligence.enrichLaunchEvent(event);
    } catch (error) {
      this.stats.parseFailures += 1;
      this.logger.warn({ error, mint: event.mint }, "token intelligence failed");
      // Continue with partial data
    }

    if (!this.isEligible(enriched)) {
      this.stats.filteredEvents += 1;
      this.logger.debug({ event: enriched }, "launch event rejected by filters");
      return;
    }

    if (this.positionManager.count() >= this.params.maxOpenPositions) {
      this.stats.filteredEvents += 1;
      this.logger.info({ limit: this.params.maxOpenPositions }, "position cap reached");
      return;
    }

    this.stats.buyAttempts += 1;
    this.logger.info({ event: enriched }, "launch event matched snipe conditions");

    try {
      const result = await this.executor.executeBuy(enriched, this.params);

      if (!result.success) {
        this.logger.warn({ event: enriched, result }, "buy attempt failed");
        await this.notifier.notifyError(`Buy failed for ${enriched.mint}: ${result.reason ?? "unknown"}`).catch(() => {});
        return;
      }

      this.stats.buySuccess += 1;

      const position: Position = {
        mint: enriched.mint,
        source: enriched.source,
        wallet: result.wallet ?? this.executor.listWallets()[0],
        symbol: enriched.symbol,
        name: enriched.name,
        decimals: enriched.decimals,
        openedAt: Date.now(),
        buySignature: result.signature,
        amountInSol: this.params.maxBuyAmountSol,
        tokenAmountRaw: result.receivedAmountRaw,
        entryPriceUsd: enriched.priceUsd,
        entryMarketCapUsd: enriched.marketCapUsd,
        currentPriceUsd: enriched.priceUsd,
        currentMarketCapUsd: enriched.marketCapUsd
      };

      this.positionManager.upsert(position);

      if (this.params.persistPositions) {
        await this.positionManager.saveToDisk();
      }

      // Only notify for significant launches, with throttling
      const lastNotified = this.lastNotificationTime.get(enriched.mint) ?? 0;
      const now = Date.now();
      if ((enriched.marketCapUsd ?? 0) >= this.params.alertMinMarketCapUsd &&
          now - lastNotified > this.notificationThrottleMs) {
        this.lastNotificationTime.set(enriched.mint, now);
        await this.notifier.notifyBuy(enriched, position, result.signature).catch(() => {});
      }

      this.logger.info({ mint: enriched.mint, signature: result.signature }, "buy attempt completed");
    } catch (error) {
      this.logger.error({ error, event: enriched }, "buy execution error");
      this.stats.parseFailures += 1;
    }
  }

  /**
   * Quick eligibility check without expensive enrichment
   * Returns false if definitely not eligible (fast reject)
   */
  private isQuickEligible(event: LaunchEvent): boolean {
    // Quick symbol check
    const symbol = (event.symbol ?? "").toUpperCase();

    if (this.params.deniedSymbols.some((item) => item.toUpperCase() === symbol)) {
      return false;
    }

    if (this.params.allowedSymbols.length > 0) {
      const allowed = this.params.allowedSymbols.map((item) => item.toUpperCase());
      if (!allowed.includes(symbol)) {
        return false;
      }
    }

    return true;
  }

  private isEligible(event: LaunchEvent): boolean {
    // Market cap check
    if (event.marketCapUsd !== undefined && event.marketCapUsd > this.params.maxMarketCapUsd) {
      return false;
    }

    // Liquidity checks
    if (event.liquiditySol !== undefined && event.liquiditySol < this.params.minLiquiditySol) {
      return false;
    }

    if (event.liquidityUsd !== undefined && event.liquidityUsd < this.params.minLiquidityUsd) {
      return false;
    }

    // Safety checks
    const safety = event.safety;
    if (safety) {
      if (safety.riskScore > this.params.maxRiskScore) {
        return false;
      }

      if (this.params.requireSellable && !safety.sellRouteAvailable) {
        return false;
      }

      if (safety.isLikelyRug) {
        return false;
      }
    }

    return true;
  }

  private async sellPosition(position: Position, reason: string): Promise<{ success: boolean; reason?: string }> {
    this.stats.sellAttempts += 1;

    try {
      const result = await this.executor.executeSell(position, this.params);

      if (!result.success) {
        this.logger.warn({ position, result }, "sell attempt failed");
        return {
          success: false,
          reason: result.reason
        };
      }

      this.stats.sellSuccess += 1;
      this.positionManager.remove(position.wallet, position.mint);

      const currentRef = position.currentPriceUsd ?? position.currentMarketCapUsd;
      const entryRef = position.entryPriceUsd ?? position.entryMarketCapUsd;
      let pnlPct: number | undefined;

      if (currentRef !== undefined && entryRef !== undefined && entryRef > 0) {
        pnlPct = ((currentRef - entryRef) / entryRef) * 100;
      }

      await this.notifier.notifySell(position, reason, result.signature, pnlPct).catch(() => {});

      if (this.params.persistPositions) {
        await this.positionManager.saveToDisk();
      }

      this.logger.info({ mint: position.mint, signature: result.signature }, "sell completed");
      return { success: true };
    } catch (error) {
      this.logger.error({ error, position }, "sell execution error");
      return { success: false, reason: String(error) };
    }
  }
}
