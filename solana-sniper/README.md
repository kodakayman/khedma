# Solana Meme Sniper Bot

TypeScript Solana sniper bot focused on resilient mainnet operation, token intelligence, and active position management.

## Major Features

- Multi-RPC resilience:
  - Multiple RPC endpoints with automatic fallback/rotation
  - Rate-limit (`429`) detection with endpoint cooldown
  - Exponential backoff + retries
  - Configurable for Helius / QuickNode / Triton style endpoints
- Better event parsing:
  - Batched `getParsedTransactions` parsing instead of single-call per signature
  - Signature mint cache
  - Parser circuit breaker to avoid runaway failures
- Token intelligence:
  - Token metadata (`symbol`, `name`, `decimals`) via token list APIs
  - Real-time market/liquidity estimates via DexScreener
  - Safety checks: mint authority, freeze authority, holder concentration, sell-route check
- Position management:
  - Position tracking in memory with optional persistence (`.positions.json`)
  - Auto-sell loop with configurable take-profit and stop-loss
  - Manual sell command by mint
  - Multi-wallet support (round-robin on buys, wallet-bound sells)
- Notifications:
  - Telegram notifications for buy/sell/error events
  - Alert threshold via `alertMinMarketCapUsd`
- CLI operations:
  - `positions`, `sell <mint>`, `status` added
- Anti-MEV improvements:
  - Jupiter swap priority fee settings
  - Dynamic compute unit limit
  - Restricted intermediate tokens for safer routing

## Install

```bash
npm install
cp .env.example .env
```

## Environment (`.env`)

Required:
- `SOLANA_RPC_URLS` or `SOLANA_RPC_URL`
- `SOLANA_PRIVATE_KEYS` or `SOLANA_PRIVATE_KEY`
- `RAYDIUM_PROGRAM_ID`
- `PUMPFUN_PROGRAM_ID`

Optional:
- `SOLANA_WS_URLS` / `SOLANA_WS_URL`
- `DRY_RUN`
- RPC retry/backoff and parser tuning vars
- `TOKEN_METADATA_URLS`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

See `.env.example` for full list.

## Run

```bash
npm run dev
```

## CLI Commands

- `help`
- `show`
- `status`
- `positions`
- `sell <mint>`
- `set <key> <value>`
- `start`
- `stop`
- `exit`

## Runtime Config

Runtime parameters are persisted in `.sniper-config.json`.

Key parameters include:
- `maxBuyAmountSol`, `slippageBps`, `sellSlippageBps`
- `maxMarketCapUsd`, `minLiquiditySol`, `minLiquidityUsd`
- `maxRiskScore`, `requireSellable`
- `autoSell`, `takeProfitPct`, `stopLossPct`
- `priorityFeeMaxLamports`
- `maxOpenPositions`, `positionCheckIntervalMs`
- `persistPositions`, `alertMinMarketCapUsd`

## Safety Notes

- Default mode is dry-run.
- Use dedicated wallets with limited funds.
- Rug checks and sellability checks are heuristic and can be wrong.
- Always test on dry-run before live mode.
