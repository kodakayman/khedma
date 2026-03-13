import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Logger } from "pino";
import { LaunchEvent, SafetyReport } from "../types.js";
import { ResilientRpcPool } from "../solana/rpc-pool.js";

const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const SOL_MINT = "So11111111111111111111111111111111111111112";

interface TokenListItem {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}

interface TokenListCache {
  loadedAt: number;
  byMint: Map<string, TokenListItem>;
}

interface MarketSnapshot {
  fetchedAt: number;
  priceUsd?: number;
  marketCapUsd?: number;
  liquidityUsd?: number;
  liquiditySol?: number;
  liquidityLockLikely?: boolean;
}

interface MintFacts {
  decimals?: number;
  mintAuthorityEnabled: boolean;
  freezeAuthorityEnabled: boolean;
  topHolderPercentage?: number;
  holderCount?: number;
}

export interface TokenIntelligenceOptions {
  metadataUrls: string[];
  marketCacheTtlMs?: number;
  sellCheckCacheTtlMs?: number;
  tokenListRefreshMs?: number;
}

export class TokenIntelligenceService {
  private tokenListCache: TokenListCache = {
    loadedAt: 0,
    byMint: new Map<string, TokenListItem>()
  };

  // Use LRU-style caches with better eviction
  private readonly marketCache = new Map<string, MarketSnapshot>();
  private readonly sellabilityCache = new Map<string, { checkedAt: number; canSell: boolean }>();
  // Cache mint facts to avoid repeated RPC calls
  private readonly mintFactsCache = new Map<string, { fetchedAt: number; facts: MintFacts }>();

  private readonly marketCacheTtlMs: number;
  private readonly sellCheckCacheTtlMs: number;
  private readonly tokenListRefreshMs: number;
  private readonly mintFactsTtlMs = 60_000; // 1 minute TTL for mint facts

  // Pending requests to avoid duplicate fetches
  private readonly pendingFetches = new Map<string, Promise<MintFacts>>();

  public constructor(
    private readonly rpcPool: ResilientRpcPool,
    private readonly logger: Logger,
    private readonly options: TokenIntelligenceOptions
  ) {
    this.marketCacheTtlMs = options.marketCacheTtlMs ?? 8_000;
    this.sellCheckCacheTtlMs = options.sellCheckCacheTtlMs ?? 20_000;
    this.tokenListRefreshMs = options.tokenListRefreshMs ?? 600_000;
  }

  public async enrichLaunchEvent(event: LaunchEvent): Promise<LaunchEvent> {
    // Fetch data in parallel but with deduplication
    const [listItem, mintFacts, marketSnapshot] = await Promise.all([
      this.lookupTokenList(event.mint),
      this.fetchMintFacts(event.mint),
      this.fetchMarketSnapshot(event.mint)
    ]);

    const decimals = listItem?.decimals ?? mintFacts.decimals;
    const canSell = await this.checkSellability(event.mint, decimals);

    const safety = this.buildSafetyReport({
      mintAuthorityEnabled: mintFacts.mintAuthorityEnabled,
      freezeAuthorityEnabled: mintFacts.freezeAuthorityEnabled,
      liquidityLockLikely: marketSnapshot.liquidityLockLikely,
      topHolderPercentage: mintFacts.topHolderPercentage,
      holderCount: mintFacts.holderCount,
      sellRouteAvailable: canSell,
      liquidityUsd: marketSnapshot.liquidityUsd
    });

    return {
      ...event,
      symbol: event.symbol ?? listItem?.symbol,
      name: event.name ?? listItem?.name,
      decimals,
      marketCapUsd: event.marketCapUsd ?? marketSnapshot.marketCapUsd,
      liquiditySol: event.liquiditySol ?? marketSnapshot.liquiditySol,
      liquidityUsd: event.liquidityUsd ?? marketSnapshot.liquidityUsd,
      priceUsd: event.priceUsd ?? marketSnapshot.priceUsd,
      safety
    };
  }

  public async fetchMarketSnapshot(mint: string): Promise<MarketSnapshot> {
    const cached = this.marketCache.get(mint);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.marketCacheTtlMs) {
      return cached;
    }

    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (!response.ok) {
        const empty: MarketSnapshot = { fetchedAt: now };
        this.marketCache.set(mint, empty);
        return empty;
      }

      const json = (await response.json()) as {
        pairs?: Array<{
          marketCap?: number | string;
          fdv?: number | string;
          priceUsd?: string;
          labels?: string[];
          liquidity?: {
            usd?: number;
            base?: number;
            quote?: number;
          };
          quoteToken?: {
            symbol?: string;
          };
          baseToken?: {
            symbol?: string;
          };
        }>;
      };

      const pairs = json.pairs ?? [];
      const best = pairs
        .filter((pair) => pair.liquidity?.usd !== undefined)
        .sort((a, b) => (Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0)))[0] ?? pairs[0];

      if (!best) {
        const empty: MarketSnapshot = { fetchedAt: now };
        this.marketCache.set(mint, empty);
        return empty;
      }

      const liquidityUsd = Number(best.liquidity?.usd ?? 0);
      let liquiditySol: number | undefined;

      if ((best.quoteToken?.symbol ?? "").toUpperCase() === "SOL") {
        liquiditySol = Number(best.liquidity?.quote ?? 0);
      } else if ((best.baseToken?.symbol ?? "").toUpperCase() === "SOL") {
        liquiditySol = Number(best.liquidity?.base ?? 0);
      }

      const liquidityLockLikely = Array.isArray(best.labels)
        ? best.labels.some((label) => {
          const value = label.toLowerCase();
          return value.includes("lock") || value.includes("burn");
        })
        : undefined;

      const snapshot: MarketSnapshot = {
        fetchedAt: now,
        priceUsd: best.priceUsd ? Number(best.priceUsd) : undefined,
        marketCapUsd: best.marketCap !== undefined ? Number(best.marketCap) : (best.fdv !== undefined ? Number(best.fdv) : undefined),
        liquidityUsd: Number.isFinite(liquidityUsd) && liquidityUsd > 0 ? liquidityUsd : undefined,
        liquiditySol: liquiditySol !== undefined && Number.isFinite(liquiditySol) && liquiditySol > 0 ? liquiditySol : undefined,
        liquidityLockLikely
      };

      // Limit cache size
      if (this.marketCache.size > 1000) {
        // Remove oldest entries
        const oldestKey = this.marketCache.keys().next().value;
        if (oldestKey) this.marketCache.delete(oldestKey);
      }

      this.marketCache.set(mint, snapshot);
      return snapshot;
    } catch (error) {
      this.logger.debug({ error, mint }, "market snapshot fetch failed");
      const fallback: MarketSnapshot = { fetchedAt: now };
      this.marketCache.set(mint, fallback);
      return fallback;
    }
  }

  private async fetchMintFacts(mint: string): Promise<MintFacts> {
    // Check cache first
    const cached = this.mintFactsCache.get(mint);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.mintFactsTtlMs) {
      return cached.facts;
    }

    // Check if already fetching
    const existingFetch = this.pendingFetches.get(mint);
    if (existingFetch) {
      return existingFetch;
    }

    // Create new fetch promise with deduplication
    const fetchPromise = this.doFetchMintFacts(mint);
    this.pendingFetches.set(mint, fetchPromise);

    try {
      const facts = await fetchPromise;
      this.mintFactsCache.set(mint, { fetchedAt: now, facts });

      // Limit cache size
      if (this.mintFactsCache.size > 500) {
        const oldestKey = this.mintFactsCache.keys().next().value;
        if (oldestKey) this.mintFactsCache.delete(oldestKey);
      }

      return facts;
    } finally {
      this.pendingFetches.delete(mint);
    }
  }

  private async doFetchMintFacts(mint: string): Promise<MintFacts> {
    try {
      const mintKey = new PublicKey(mint);

      // Fetch all data in parallel
      const [mintInfo, largestAccounts, supply] = await Promise.all([
        this.rpcPool.call(
          "getMint",
          (connection) => getMint(connection, mintKey, "confirmed"),
          2, // fewer retries
          3000 // 3s timeout
        ),
        this.rpcPool.call(
          "getTokenLargestAccounts",
          (connection) => connection.getTokenLargestAccounts(mintKey, "confirmed"),
          2,
          3000
        ),
        this.rpcPool.call(
          "getTokenSupply",
          (connection) => connection.getTokenSupply(mintKey, "confirmed"),
          2,
          3000
        )
      ]);

      let topHolderPercentage: number | undefined;
      const top = largestAccounts.value[0];
      const totalRaw = supply.value.amount;
      if (top && totalRaw !== "0") {
        const topRaw = top.amount;
        const total = BigInt(totalRaw);
        if (total > 0n) {
          const numerator = Number((BigInt(topRaw) * 10000n) / total);
          topHolderPercentage = numerator / 100;
        }
      }

      return {
        decimals: mintInfo.decimals,
        mintAuthorityEnabled: mintInfo.mintAuthority !== null,
        freezeAuthorityEnabled: mintInfo.freezeAuthority !== null,
        topHolderPercentage,
        holderCount: largestAccounts.value.length
      };
    } catch (error) {
      this.logger.debug({ error, mint }, "mint fact fetch failed");
      return {
        mintAuthorityEnabled: false,
        freezeAuthorityEnabled: false
      };
    }
  }

  private async lookupTokenList(mint: string): Promise<TokenListItem | undefined> {
    const now = Date.now();
    if (now - this.tokenListCache.loadedAt > this.tokenListRefreshMs || this.tokenListCache.byMint.size === 0) {
      // Don't await in hot path - return cached while refreshing in background
      this.refreshTokenLists().catch(err => this.logger.debug({ err }, "token list refresh failed"));
    }

    return this.tokenListCache.byMint.get(mint);
  }

  private async refreshTokenLists(): Promise<void> {
    for (const url of this.options.metadataUrls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          continue;
        }

        const json = (await response.json()) as unknown;
        const rows = Array.isArray(json)
          ? json
          : (typeof json === "object" && json !== null && Array.isArray((json as { tokens?: unknown[] }).tokens)
            ? (json as { tokens: unknown[] }).tokens
            : []);

        const map = new Map<string, TokenListItem>();
        for (const row of rows) {
          if (!row || typeof row !== "object") {
            continue;
          }

          const item = row as Record<string, unknown>;
          const addressValue = item.address;
          if (typeof addressValue !== "string") {
            continue;
          }

          const decimalsValue = item.decimals;
          map.set(addressValue, {
            address: addressValue,
            symbol: typeof item.symbol === "string" ? item.symbol : undefined,
            name: typeof item.name === "string" ? item.name : undefined,
            decimals: typeof decimalsValue === "number" ? decimalsValue : undefined
          });
        }

        if (map.size > 0) {
          this.tokenListCache = {
            loadedAt: Date.now(),
            byMint: map
          };

          this.logger.info({ url, count: map.size }, "token metadata list loaded");
          return;
        }
      } catch (error) {
        this.logger.debug({ error, url }, "token list fetch failed");
      }
    }

    this.tokenListCache.loadedAt = Date.now();
  }

  private async checkSellability(mint: string, decimals: number | undefined): Promise<boolean> {
    const cached = this.sellabilityCache.get(mint);
    const now = Date.now();
    if (cached && now - cached.checkedAt < this.sellCheckCacheTtlMs) {
      return cached.canSell;
    }

    const unitDecimals = decimals ?? 6;
    const rawAmount = Math.max(1, Math.floor(Math.pow(10, Math.min(unitDecimals, 9)) / 100));

    try {
      const quoteUrl = new URL(JUPITER_QUOTE_URL);
      quoteUrl.searchParams.set("inputMint", mint);
      quoteUrl.searchParams.set("outputMint", SOL_MINT);
      quoteUrl.searchParams.set("amount", String(rawAmount));
      quoteUrl.searchParams.set("slippageBps", "1500");
      quoteUrl.searchParams.set("onlyDirectRoutes", "false");
      quoteUrl.searchParams.set("restrictIntermediateTokens", "true");

      const response = await fetch(quoteUrl);
      if (!response.ok) {
        this.sellabilityCache.set(mint, { checkedAt: now, canSell: false });
        return false;
      }

      const json = (await response.json()) as { data?: Array<{ outAmount?: string }> };
      const outAmount = json.data?.[0]?.outAmount;
      const canSell = outAmount !== undefined && Number(outAmount) > 0;
      this.sellabilityCache.set(mint, { checkedAt: now, canSell });
      return canSell;
    } catch (error) {
      this.logger.debug({ error, mint }, "sellability check failed");
      this.sellabilityCache.set(mint, { checkedAt: now, canSell: false });
      return false;
    }
  }

  private buildSafetyReport(input: {
    mintAuthorityEnabled: boolean;
    freezeAuthorityEnabled: boolean;
    liquidityLockLikely?: boolean;
    topHolderPercentage?: number;
    holderCount?: number;
    sellRouteAvailable: boolean;
    liquidityUsd?: number;
  }): SafetyReport {
    const flags: string[] = [];
    let riskScore = 0;

    if (input.mintAuthorityEnabled) {
      flags.push("Mint authority enabled");
      riskScore += 35;
    }

    if (input.freezeAuthorityEnabled) {
      flags.push("Freeze authority enabled");
      riskScore += 20;
    }

    if (input.topHolderPercentage !== undefined && input.topHolderPercentage > 35) {
      flags.push(`Top holder concentration ${input.topHolderPercentage.toFixed(2)}%`);
      riskScore += input.topHolderPercentage > 50 ? 40 : 25;
    }

    if ((input.liquidityUsd ?? 0) < 5_000) {
      flags.push("Low liquidity");
      riskScore += 15;
    }

    if (!input.sellRouteAvailable) {
      flags.push("No immediate sell route");
      riskScore += 30;
    }

    if (input.liquidityLockLikely === false) {
      flags.push("Liquidity lock not detected");
      riskScore += 10;
    }

    riskScore = Math.min(100, riskScore);

    return {
      riskScore,
      flags,
      mintAuthorityEnabled: input.mintAuthorityEnabled,
      freezeAuthorityEnabled: input.freezeAuthorityEnabled,
      liquidityLockLikely: input.liquidityLockLikely,
      topHolderPercentage: input.topHolderPercentage,
      holderCount: input.holderCount,
      sellRouteAvailable: input.sellRouteAvailable,
      isLikelyRug: riskScore >= 70
    };
  }
}
