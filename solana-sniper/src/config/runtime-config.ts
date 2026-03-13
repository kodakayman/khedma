import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { SnipeParameters } from "../types.js";

const runtimeConfigSchema = z.object({
  maxBuyAmountSol: z.number().positive(),
  slippageBps: z.number().int().min(1).max(5000),
  sellSlippageBps: z.number().int().min(1).max(5000),
  maxMarketCapUsd: z.number().positive(),
  minLiquiditySol: z.number().nonnegative(),
  minLiquidityUsd: z.number().nonnegative(),
  allowedSymbols: z.array(z.string()),
  deniedSymbols: z.array(z.string()),
  dryRun: z.boolean(),
  autoSell: z.boolean(),
  takeProfitPct: z.number().nonnegative(),
  stopLossPct: z.number().nonnegative(),
  maxRiskScore: z.number().min(0).max(100),
  requireSellable: z.boolean(),
  maxOpenPositions: z.number().int().positive(),
  priorityFeeMaxLamports: z.number().int().nonnegative(),
  positionCheckIntervalMs: z.number().int().positive(),
  persistPositions: z.boolean(),
  alertMinMarketCapUsd: z.number().nonnegative()
});

const CONFIG_FILE = resolve(process.cwd(), ".sniper-config.json");

export const defaultSnipeParameters: SnipeParameters = {
  maxBuyAmountSol: 0.1,
  slippageBps: 300,
  sellSlippageBps: 500,
  maxMarketCapUsd: 250_000,
  minLiquiditySol: 2,
  minLiquidityUsd: 4_000,
  allowedSymbols: [],
  deniedSymbols: [],
  dryRun: true,
  autoSell: true,
  takeProfitPct: 35,
  stopLossPct: 20,
  maxRiskScore: 65,
  requireSellable: true,
  maxOpenPositions: 4,
  priorityFeeMaxLamports: 250_000,
  positionCheckIntervalMs: 15_000,
  persistPositions: true,
  alertMinMarketCapUsd: 40_000
};

export async function loadRuntimeConfig(): Promise<SnipeParameters> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf8");
    return runtimeConfigSchema.parse(JSON.parse(content));
  } catch {
    return defaultSnipeParameters;
  }
}

export async function saveRuntimeConfig(params: SnipeParameters): Promise<void> {
  const data = runtimeConfigSchema.parse(params);
  await fs.writeFile(CONFIG_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
