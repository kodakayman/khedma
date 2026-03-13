import { PublicKey } from "@solana/web3.js";
import { InteractiveCli } from "./cli/interactive-cli.js";
import { loadEnv, parseBoolean } from "./config/env.js";
import {
  defaultSnipeParameters,
  loadRuntimeConfig,
  saveRuntimeConfig
} from "./config/runtime-config.js";
import { TokenIntelligenceService } from "./intelligence/token-intelligence.js";
import { BatchedSignatureParser } from "./monitor/event-parser.js";
import { PumpfunLaunchMonitor } from "./monitor/pumpfun-monitor.js";
import { RaydiumLaunchMonitor } from "./monitor/raydium-monitor.js";
import { NoopNotifier } from "./notifications/notifier.js";
import { TelegramNotifier } from "./notifications/telegram-notifier.js";
import { PositionManager } from "./position/position-manager.js";
import { ResilientRpcPool } from "./solana/rpc-pool.js";
import { loadKeypairs, WalletPool } from "./solana/wallet.js";
import { SniperEngine } from "./sniper/sniper-engine.js";
import {
  AdaptiveTradeExecutor,
  DryRunTradeExecutor,
  JupiterTradeExecutor,
  TradeExecutor
} from "./sniper/trade-executor.js";
import { createLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  const rpcPool = new ResilientRpcPool(
    env.rpcUrls.map((rpcUrl, index) => ({
      rpcUrl,
      wsUrl: env.wsUrls[index] ?? env.wsUrls[0]
    })),
    {
      commitment: "confirmed",
      maxRetries: env.RPC_MAX_RETRIES,
      baseBackoffMs: env.RPC_BASE_BACKOFF_MS,
      maxBackoffMs: env.RPC_MAX_BACKOFF_MS,
      rateLimitCooldownMs: env.RPC_RATE_LIMIT_COOLDOWN_MS
    },
    logger
  );

  const walletPool = new WalletPool(loadKeypairs(env.privateKeys));

  const persistedParams = await loadRuntimeConfig();
  const envDryRun = parseBoolean(env.DRY_RUN, defaultSnipeParameters.dryRun);
  const initialParams = { ...persistedParams, dryRun: envDryRun };
  await saveRuntimeConfig(initialParams);

  const parser = new BatchedSignatureParser(rpcPool, logger, {
    batchSize: env.PARSER_BATCH_SIZE,
    batchWindowMs: env.PARSER_BATCH_WINDOW_MS,
    circuitBreakerThreshold: env.PARSER_CIRCUIT_BREAKER_THRESHOLD,
    circuitBreakerCooldownMs: env.PARSER_CIRCUIT_BREAKER_COOLDOWN_MS
  }, env.HELIUS_ENHANCED_TX_API);

  const intelligence = new TokenIntelligenceService(rpcPool, logger, {
    metadataUrls: env.TOKEN_METADATA_URLS
  });

  const positionManager = new PositionManager(logger);
  if (initialParams.persistPositions) {
    await positionManager.loadFromDisk();
  }

  const notifier = (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
    ? new TelegramNotifier(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, logger)
    : new NoopNotifier();

  const monitors = [
    new RaydiumLaunchMonitor(rpcPool.primaryConnection, new PublicKey(env.RAYDIUM_PROGRAM_ID), parser, logger),
    new PumpfunLaunchMonitor(rpcPool.primaryConnection, new PublicKey(env.PUMPFUN_PROGRAM_ID), parser, logger)
  ];

  const executor: TradeExecutor = new AdaptiveTradeExecutor(
    new DryRunTradeExecutor(walletPool, logger),
    new JupiterTradeExecutor(rpcPool, walletPool, logger)
  );

  const engine = new SniperEngine(
    monitors,
    executor,
    intelligence,
    positionManager,
    notifier,
    rpcPool,
    parser,
    logger,
    initialParams
  );

  const cli = new InteractiveCli(engine, initialParams, logger);

  process.on("SIGINT", async () => {
    logger.warn("received SIGINT, shutting down");
    await engine.stop();
    process.exit(0);
  });

  logger.info(
    {
      wallets: walletPool.listWallets(),
      dryRun: initialParams.dryRun,
      rpcUrls: env.rpcUrls,
      telegramEnabled: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
    },
    "solana meme sniper initialized"
  );

  await cli.run();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", error);
  process.exit(1);
});
