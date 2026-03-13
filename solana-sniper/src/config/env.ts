import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const rawEnvSchema = z.object({
  SOLANA_RPC_URL: z.string().url().optional(),
  SOLANA_RPC_URLS: z.string().optional(),
  SOLANA_WS_URL: z.string().url().optional(),
  SOLANA_WS_URLS: z.string().optional(),
  SOLANA_PRIVATE_KEY: z.string().min(1).optional(),
  SOLANA_PRIVATE_KEYS: z.string().optional(),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  RAYDIUM_PROGRAM_ID: z.string().min(32),
  PUMPFUN_PROGRAM_ID: z.string().min(32),
  DRY_RUN: z.string().optional(),
  RPC_MAX_RETRIES: z.string().optional(),
  RPC_BASE_BACKOFF_MS: z.string().optional(),
  RPC_MAX_BACKOFF_MS: z.string().optional(),
  RPC_RATE_LIMIT_COOLDOWN_MS: z.string().optional(),
  PARSER_BATCH_SIZE: z.string().optional(),
  PARSER_BATCH_WINDOW_MS: z.string().optional(),
  PARSER_CIRCUIT_BREAKER_THRESHOLD: z.string().optional(),
  PARSER_CIRCUIT_BREAKER_COOLDOWN_MS: z.string().optional(),
  TOKEN_METADATA_URLS: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  HELIUS_ENHANCED_TX_API: z.string().optional()
});

function parseCsv(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWalletKeys(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === "number") {
          return [JSON.stringify(parsed)];
        }

        return parsed
          .map((value) => {
            if (Array.isArray(value)) {
              return JSON.stringify(value);
            }

            return String(value).trim();
          })
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

export interface AppEnv {
  rpcUrls: string[];
  wsUrls: string[];
  privateKeys: string[];
  LOG_LEVEL: (typeof logLevels)[number];
  RAYDIUM_PROGRAM_ID: string;
  PUMPFUN_PROGRAM_ID: string;
  DRY_RUN?: string;
  RPC_MAX_RETRIES: number;
  RPC_BASE_BACKOFF_MS: number;
  RPC_MAX_BACKOFF_MS: number;
  RPC_RATE_LIMIT_COOLDOWN_MS: number;
  PARSER_BATCH_SIZE: number;
  PARSER_BATCH_WINDOW_MS: number;
  PARSER_CIRCUIT_BREAKER_THRESHOLD: number;
  PARSER_CIRCUIT_BREAKER_COOLDOWN_MS: number;
  TOKEN_METADATA_URLS: string[];
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  HELIUS_ENHANCED_TX_API?: string;
}

export function loadEnv(): AppEnv {
  const raw = rawEnvSchema.parse({
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
    SOLANA_RPC_URLS: process.env.SOLANA_RPC_URLS,
    SOLANA_WS_URL: process.env.SOLANA_WS_URL,
    SOLANA_WS_URLS: process.env.SOLANA_WS_URLS,
    SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY,
    SOLANA_PRIVATE_KEYS: process.env.SOLANA_PRIVATE_KEYS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    RAYDIUM_PROGRAM_ID: process.env.RAYDIUM_PROGRAM_ID,
    PUMPFUN_PROGRAM_ID: process.env.PUMPFUN_PROGRAM_ID,
    DRY_RUN: process.env.DRY_RUN,
    RPC_MAX_RETRIES: process.env.RPC_MAX_RETRIES,
    RPC_BASE_BACKOFF_MS: process.env.RPC_BASE_BACKOFF_MS,
    RPC_MAX_BACKOFF_MS: process.env.RPC_MAX_BACKOFF_MS,
    RPC_RATE_LIMIT_COOLDOWN_MS: process.env.RPC_RATE_LIMIT_COOLDOWN_MS,
    PARSER_BATCH_SIZE: process.env.PARSER_BATCH_SIZE,
    PARSER_BATCH_WINDOW_MS: process.env.PARSER_BATCH_WINDOW_MS,
    PARSER_CIRCUIT_BREAKER_THRESHOLD: process.env.PARSER_CIRCUIT_BREAKER_THRESHOLD,
    PARSER_CIRCUIT_BREAKER_COOLDOWN_MS: process.env.PARSER_CIRCUIT_BREAKER_COOLDOWN_MS,
    TOKEN_METADATA_URLS: process.env.TOKEN_METADATA_URLS,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    HELIUS_ENHANCED_TX_API: process.env.HELIUS_ENHANCED_TX_API
  });

  const rpcUrls = parseCsv(raw.SOLANA_RPC_URLS);
  if (raw.SOLANA_RPC_URL) {
    rpcUrls.push(raw.SOLANA_RPC_URL);
  }

  const uniqueRpcUrls = Array.from(new Set(rpcUrls));
  if (uniqueRpcUrls.length === 0) {
    throw new Error("At least one RPC endpoint is required via SOLANA_RPC_URL or SOLANA_RPC_URLS");
  }

  const wsUrls = parseCsv(raw.SOLANA_WS_URLS);
  if (raw.SOLANA_WS_URL) {
    wsUrls.push(raw.SOLANA_WS_URL);
  }

  const privateKeys = parseWalletKeys(raw.SOLANA_PRIVATE_KEYS);
  if (raw.SOLANA_PRIVATE_KEY) {
    privateKeys.push(raw.SOLANA_PRIVATE_KEY);
  }

  const uniqueKeys = Array.from(new Set(privateKeys));
  if (uniqueKeys.length === 0) {
    throw new Error("At least one private key is required via SOLANA_PRIVATE_KEY or SOLANA_PRIVATE_KEYS");
  }

  const tokenMetadataUrls = parseCsv(raw.TOKEN_METADATA_URLS);
  const resolvedMetadataUrls = tokenMetadataUrls.length > 0
    ? tokenMetadataUrls
    : ["https://token.jup.ag/all", "https://cache.jup.ag/tokens"];

  return {
    rpcUrls: uniqueRpcUrls,
    wsUrls: wsUrls,
    privateKeys: uniqueKeys,
    LOG_LEVEL: raw.LOG_LEVEL,
    RAYDIUM_PROGRAM_ID: raw.RAYDIUM_PROGRAM_ID,
    PUMPFUN_PROGRAM_ID: raw.PUMPFUN_PROGRAM_ID,
    DRY_RUN: raw.DRY_RUN,
    RPC_MAX_RETRIES: parseInteger(raw.RPC_MAX_RETRIES, 5),
    RPC_BASE_BACKOFF_MS: parseInteger(raw.RPC_BASE_BACKOFF_MS, 250),
    RPC_MAX_BACKOFF_MS: parseInteger(raw.RPC_MAX_BACKOFF_MS, 4_000),
    RPC_RATE_LIMIT_COOLDOWN_MS: parseInteger(raw.RPC_RATE_LIMIT_COOLDOWN_MS, 1_500),
    PARSER_BATCH_SIZE: parseInteger(raw.PARSER_BATCH_SIZE, 16),
    PARSER_BATCH_WINDOW_MS: parseInteger(raw.PARSER_BATCH_WINDOW_MS, 80),
    PARSER_CIRCUIT_BREAKER_THRESHOLD: parseInteger(raw.PARSER_CIRCUIT_BREAKER_THRESHOLD, 20),
    PARSER_CIRCUIT_BREAKER_COOLDOWN_MS: parseInteger(raw.PARSER_CIRCUIT_BREAKER_COOLDOWN_MS, 12_000),
    TOKEN_METADATA_URLS: resolvedMetadataUrls,
    TELEGRAM_BOT_TOKEN: raw.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: raw.TELEGRAM_CHAT_ID,
    HELIUS_ENHANCED_TX_API: raw.HELIUS_ENHANCED_TX_API
  };
}

export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}
