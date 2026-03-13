export type LaunchSource = "raydium" | "pumpfun";

export interface SafetyReport {
  riskScore: number;
  flags: string[];
  mintAuthorityEnabled: boolean;
  freezeAuthorityEnabled: boolean;
  liquidityLockLikely?: boolean;
  topHolderPercentage?: number;
  holderCount?: number;
  sellRouteAvailable: boolean;
  isLikelyRug: boolean;
}

export interface LaunchEvent {
  source: LaunchSource;
  mint: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  marketCapUsd?: number;
  liquiditySol?: number;
  liquidityUsd?: number;
  priceUsd?: number;
  signature: string;
  slot: number;
  discoveredAt: number;
  safety?: SafetyReport;
}

export interface SnipeParameters {
  maxBuyAmountSol: number;
  slippageBps: number;
  sellSlippageBps: number;
  maxMarketCapUsd: number;
  minLiquiditySol: number;
  minLiquidityUsd: number;
  allowedSymbols: string[];
  deniedSymbols: string[];
  dryRun: boolean;
  autoSell: boolean;
  takeProfitPct: number;
  stopLossPct: number;
  maxRiskScore: number;
  requireSellable: boolean;
  maxOpenPositions: number;
  priorityFeeMaxLamports: number;
  positionCheckIntervalMs: number;
  persistPositions: boolean;
  alertMinMarketCapUsd: number;
}

export interface BuyResult {
  success: boolean;
  signature?: string;
  reason?: string;
  wallet?: string;
  receivedAmountRaw?: string;
}

export interface SellResult {
  success: boolean;
  signature?: string;
  reason?: string;
  wallet?: string;
  soldAmountRaw?: string;
}

export interface Position {
  mint: string;
  source: LaunchSource;
  wallet: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  openedAt: number;
  buySignature?: string;
  amountInSol: number;
  tokenAmountRaw?: string;
  entryPriceUsd?: number;
  entryMarketCapUsd?: number;
  currentPriceUsd?: number;
  currentMarketCapUsd?: number;
}

export interface EngineStats {
  totalEvents: number;
  parseFailures: number;
  filteredEvents: number;
  buyAttempts: number;
  buySuccess: number;
  sellAttempts: number;
  sellSuccess: number;
}
