import { EventEmitter } from 'node:events';
import TwitterClient from './api/twitter.js';
import MultiSourceClient from './api/multi-source.js';
import GeckoTerminalClient from './api/geckoterminal.js';
import { calculateSocialScore, scoreToken } from './analyzer/scoring.js';

const USD_COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const DEFAULT_CONFIG = {
  discoveryIntervalMs: 120_000, // 2 minutes - GeckoTerminal free tier has strict rate limits
  hotPollIntervalMs: 30_000,
  geckoRefreshIntervalMs: 180_000, // 3 minutes
  twitterRefreshIntervalMs: 60_000,
  discoveryLimit: 10, // pages * 20 = 100 tokens, // Reduced from 150 to reduce API calls
  hotTokenLimit: 25,
  newPairWindowMs: 24 * 60 * 60 * 1000,  // 24 hours
  maxTrackedTokens: 200,
  alertCooldownMs: 90_000,
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsdCompact(value) {
  const numeric = toNumber(value);
  return `$${USD_COMPACT.format(numeric)}`;
}

function normalizeTimestamp(ts) {
  let value = toNumber(ts);
  if (value <= 0) return Date.now();
  if (value < 10_000_000_000) {
    value *= 1000;
  }
  return value;
}

export class MemeCoinMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dexClient = new MultiSourceClient();
    this.geckoClient = new GeckoTerminalClient();

    this.tokensByPair = new Map();
    this.hotPairs = new Set();
    this.alertState = new Map();
    this.geckoLiquidityByToken = new Map();
    this.socialByToken = new Map();
    this.twitterClient = new TwitterClient();

    this.discoveryTimer = null;
    this.hotPollTimer = null;
    this.geckoRefreshTimer = null;
    this.twitterRefreshTimer = null;
    this.running = false;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    // Stagger initial calls to avoid rate limiting
    await this.#refreshGeckoLiquidity(true);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    await this.pollDiscovery();
    await this.#refreshHotTokenSocialScores(true);

    this.discoveryTimer = setInterval(() => {
      this.pollDiscovery().catch((error) => {
        this.#log(`Discovery polling failed: ${error.message}`);
      });
    }, this.config.discoveryIntervalMs);

    this.hotPollTimer = setInterval(() => {
      this.pollHotTokens().catch((error) => {
        this.#log(`Hot token polling failed: ${error.message}`);
      });
    }, this.config.hotPollIntervalMs);

    this.geckoRefreshTimer = setInterval(() => {
      this.#refreshGeckoLiquidity().catch((error) => {
        this.#log(`GeckoTerminal refresh failed: ${error.message}`);
      });
    }, this.config.geckoRefreshIntervalMs);

    this.twitterRefreshTimer = setInterval(() => {
      this.#refreshHotTokenSocialScores().catch((error) => {
        this.#log(`Twitter scoring refresh failed: ${error.message}`);
      });
    }, this.config.twitterRefreshIntervalMs);
  }

  stop() {
    if (!this.running) return;

    this.running = false;
    clearInterval(this.discoveryTimer);
    clearInterval(this.hotPollTimer);
    clearInterval(this.geckoRefreshTimer);
    clearInterval(this.twitterRefreshTimer);

    this.discoveryTimer = null;
    this.hotPollTimer = null;
    this.geckoRefreshTimer = null;
    this.twitterRefreshTimer = null;
  }

  async pollDiscovery() {
    let rawPairs = [];
    try {
      rawPairs = await this.dexClient.getSolanaPairs({
        limit: 200,
        orderBy: 'volume',
      });
    } catch (error) {
      this.#log(`Discovery API unavailable: ${error.message}`);
      return;
    }

    let updatedCount = 0;
    const now = Date.now();

    for (const rawPair of rawPairs) {
      const normalized = this.#normalizeDexPair(rawPair);
      if (!normalized) continue;

      if (this.#upsertPair(normalized, now)) {
        updatedCount += 1;
      }
    }

    this.#pruneTrackedTokens();

    if (updatedCount > 0) {
      this.emit('update', this.getState());
    }
  }

  async pollHotTokens() {
    const targets = this.#selectHotPairs();
    if (targets.length === 0) return;

    const fetches = targets.map((pairAddress) => this.dexClient.getPair(pairAddress));
    const results = await Promise.allSettled(fetches);

    const now = Date.now();
    let updatedCount = 0;

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const normalized = this.#normalizeDexPair(result.value);
      if (!normalized) continue;

      if (this.#upsertPair(normalized, now)) {
        updatedCount += 1;
      }
    }

    if (updatedCount > 0) {
      this.emit('update', this.getState());
    }
  }

  getState() {
    const now = Date.now();
    const sorted = Array
      .from(this.tokensByPair.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return toNumber(b.volume?.m5) - toNumber(a.volume?.m5);
      });

    const allTokens = sorted.slice(0, this.config.maxTrackedTokens);
    const liveHype = allTokens.filter((token) => token.score > 70);
    const watchList = allTokens.filter((token) => token.score >= 50 && token.score <= 70);
    const newPairs = allTokens
      .filter((token) => now - token.pairCreatedAt <= 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => b.pairCreatedAt - a.pairCreatedAt);

    return {
      updatedAt: new Date(now).toISOString(),
      counts: {
        tracked: allTokens.length,
        liveHype: liveHype.length,
        watchList: watchList.length,
        newPairs: newPairs.length,
      },
      liveHype,
      watchList,
      newPairs,
      allTokens,
    };
  }

  #normalizeDexPair(rawPair) {
    const pairAddress = rawPair?.pairAddress ?? null;
    const baseTokenAddress = rawPair?.baseToken?.address ?? null;

    if (!pairAddress || !baseTokenAddress) {
      return null;
    }

    const geckoData = this.geckoLiquidityByToken.get(baseTokenAddress);
    const dexLiquidity = toNumber(rawPair?.liquidity?.usd);

    return {
      pairAddress,
      dexUrl: rawPair?.url ?? null,
      dexId: rawPair?.dexId ?? 'unknown',
      chainId: rawPair?.chainId ?? 'solana',
      tokenAddress: baseTokenAddress,
      name: rawPair?.baseToken?.name ?? 'Unknown',
      symbol: rawPair?.baseToken?.symbol ?? '???',
      priceUsd: toNumber(rawPair?.priceUsd),
      pairCreatedAt: normalizeTimestamp(rawPair?.pairCreatedAt),
      liquidityUsd: dexLiquidity > 0 ? dexLiquidity : toNumber(geckoData?.reserveInUsd),
      marketCapUsd: toNumber(rawPair?.marketCap) || toNumber(geckoData?.marketCapUsd),
      fdvUsd: toNumber(rawPair?.fdv) || toNumber(geckoData?.fdvUsd),
      volume: {
        m5: toNumber(rawPair?.volume?.m5),
        h1: toNumber(rawPair?.volume?.h1),
        h24: toNumber(rawPair?.volume?.h24),
      },
      txns: {
        m5: {
          buys: toNumber(rawPair?.txns?.m5?.buys),
          sells: toNumber(rawPair?.txns?.m5?.sells),
        },
        h1: {
          buys: toNumber(rawPair?.txns?.h1?.buys),
          sells: toNumber(rawPair?.txns?.h1?.sells),
        },
      },
      priceChange: {
        m5: toNumber(rawPair?.priceChange?.m5),
        h1: toNumber(rawPair?.priceChange?.h1),
        h24: toNumber(rawPair?.priceChange?.h24),
      },
    };
  }

  #upsertPair(nextToken, now) {
    const previous = this.tokensByPair.get(nextToken.pairAddress);
    const history = previous?.history ? [...previous.history] : [];

    history.push({
      timestamp: now,
      volume5m: nextToken.volume.m5,
    });

    const maxHistoryPoints = 360;
    if (history.length > maxHistoryPoints) {
      history.splice(0, history.length - maxHistoryPoints);
    }

    const socialData = this.socialByToken.get(nextToken.tokenAddress) || null;
    const scoreResult = scoreToken({
      current: this.#buildScoreInput(nextToken),
      history,
      social: socialData,
      now,
    });

    const token = {
      ...nextToken,
      history,
      score: scoreResult.total,
      scoreBreakdown: scoreResult.breakdown,
      scoreMetrics: scoreResult.metrics,
      reasons: scoreResult.reasons,
      buySellRatio: scoreResult.metrics.buySellRatio,
      socialData,
      lastUpdated: now,
    };

    this.tokensByPair.set(token.pairAddress, token);

    if (token.score >= 50) {
      this.hotPairs.add(token.pairAddress);
    } else if (token.score < 45) {
      this.hotPairs.delete(token.pairAddress);
    }

    this.#emitAlerts(previous, token);

    if (!previous) {
      this.#logAlert('🆕', token, 'new pair detected');
    }

    return !previous
      || previous.score !== token.score
      || previous.priceUsd !== token.priceUsd
      || previous.volume.m5 !== token.volume.m5
      || previous.liquidityUsd !== token.liquidityUsd
      || toNumber(previous?.socialData?.mentionCount) !== toNumber(token?.socialData?.mentionCount)
      || toNumber(previous?.socialData?.sentimentScore) !== toNumber(token?.socialData?.sentimentScore);
  }

  #buildScoreInput(token) {
    return {
      volume5m: token?.volume?.m5,
      volume1h: token?.volume?.h1,
      liquidityUsd: token?.liquidityUsd,
      priceChange1h: token?.priceChange?.h1,
      buys5m: token?.txns?.m5?.buys,
      sells5m: token?.txns?.m5?.sells,
    };
  }

  #emitAlerts(previous, token) {
    const fiveMinuteSpike = toNumber(token?.scoreMetrics?.fiveMinuteSpike);
    const fifteenMinuteSpike = toNumber(token?.scoreMetrics?.fifteenMinuteSpike);

    let emoji = null;
    let reason = null;

    if (fiveMinuteSpike >= 10) {
      emoji = '🚀';
      reason = `MOONSHOT ${fiveMinuteSpike.toFixed(1)}x volume spike in 5m`;
    } else if (fiveMinuteSpike >= 5) {
      emoji = '🔥';
      reason = `HIGH ${fiveMinuteSpike.toFixed(1)}x volume spike in 5m`;
    } else if (fifteenMinuteSpike >= 3) {
      emoji = '⚡';
      reason = `ACTIVE ${fifteenMinuteSpike.toFixed(1)}x volume spike in 15m`;
    } else if (token.score > 70 && (!previous || previous.score <= 70)) {
      emoji = '🚀';
      reason = 'entered LIVE HYPE (>70 score)';
    }

    if (reason && this.#shouldAlert(token.pairAddress, reason)) {
      this.#logAlert(emoji, token, reason);
    }

    if (previous) {
      if (previous.liquidityUsd < 10_000 && token.liquidityUsd >= 10_000) {
        this.#logAlert('💧', token, 'liquidity above $10K (tradeable)');
      }

      if (previous.liquidityUsd < 30_000 && token.liquidityUsd >= 30_000) {
        this.#logAlert('💧', token, 'liquidity above $30K (solid)');
      }
    }
  }

  #shouldAlert(pairAddress, reason) {
    const now = Date.now();
    const current = this.alertState.get(pairAddress);

    if (!current) {
      this.alertState.set(pairAddress, { reason, ts: now });
      return true;
    }

    const isNewReason = current.reason !== reason;
    const cooldownPassed = now - current.ts >= this.config.alertCooldownMs;

    if (isNewReason || cooldownPassed) {
      this.alertState.set(pairAddress, { reason, ts: now });
      return true;
    }

    return false;
  }

  #selectHotPairs() {
    return this.#selectHotTokens().map((token) => token.pairAddress);
  }

  #selectHotTokens() {
    const tokens = Array
      .from(this.hotPairs)
      .map((pairAddress) => this.tokensByPair.get(pairAddress))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.hotTokenLimit);

    return tokens;
  }

  #selectTwitterCandidates() {
    return Array
      .from(this.tokensByPair.values())
      .filter((token) => toNumber(token?.score) > 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxTrackedTokens);
  }

  async #refreshHotTokenSocialScores(forceRefresh = false) {
    const twitterCandidates = this.#selectTwitterCandidates();
    if (twitterCandidates.length === 0) return;

    const now = Date.now();
    let updatedCount = 0;
    let rateLimitSeen = false;

    for (const token of twitterCandidates) {
      console.log(
        `[${new Date().toISOString()}] Twitter fetch -> ${token.symbol} (${token.name}), score=${Number(token.score || 0).toFixed(2)}`,
      );

      let social;
      try {
        social = await calculateSocialScore({
          symbol: token.symbol,
          tokenName: token.name,
          now,
          forceRefresh,
          twitterClient: this.twitterClient,
        });
      } catch (error) {
        this.#log(`Twitter scoring failed: ${error?.message || error}`);
        continue;
      }

      if (!token?.tokenAddress) continue;

      if (social?.rateLimited) {
        rateLimitSeen = true;
        this.#log('Twitter API rate-limited (429), skipping Twitter refresh for this cycle');
        break;
      }

      const previousSocial = this.socialByToken.get(token.tokenAddress);
      this.socialByToken.set(token.tokenAddress, social);

      const existing = this.tokensByPair.get(token.pairAddress);
      if (!existing) continue;

      const scoreResult = scoreToken({
        current: this.#buildScoreInput(existing),
        history: existing.history || [],
        social,
        now,
      });

      const rescored = {
        ...existing,
        score: scoreResult.total,
        scoreBreakdown: scoreResult.breakdown,
        scoreMetrics: scoreResult.metrics,
        reasons: scoreResult.reasons,
        buySellRatio: scoreResult.metrics.buySellRatio,
        socialData: social,
        lastUpdated: now,
      };

      this.tokensByPair.set(rescored.pairAddress, rescored);

      if (rescored.score >= 50) {
        this.hotPairs.add(rescored.pairAddress);
      } else if (rescored.score < 45) {
        this.hotPairs.delete(rescored.pairAddress);
      }

      const scoreChanged = existing.score !== rescored.score;
      const mentionsChanged = toNumber(previousSocial?.mentionCount) !== toNumber(social?.mentionCount);
      const sentimentChanged = toNumber(previousSocial?.sentimentScore) !== toNumber(social?.sentimentScore);

      if (scoreChanged || mentionsChanged || sentimentChanged) {
        updatedCount += 1;
      }
    }

    if (updatedCount > 0) {
      this.emit('update', this.getState());
    }

    if (rateLimitSeen) {
      return;
    }
  }

  #pruneTrackedTokens() {
    if (this.tokensByPair.size <= this.config.maxTrackedTokens) {
      return;
    }

    const sorted = Array
      .from(this.tokensByPair.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return toNumber(b.volume?.m5) - toNumber(a.volume?.m5);
      });

    const keep = new Set(
      sorted
        .slice(0, this.config.maxTrackedTokens)
        .map((token) => token.pairAddress),
    );

    for (const pairAddress of this.tokensByPair.keys()) {
      if (!keep.has(pairAddress)) {
        const tokenAddress = this.tokensByPair.get(pairAddress)?.tokenAddress;
        this.tokensByPair.delete(pairAddress);
        this.hotPairs.delete(pairAddress);
        this.alertState.delete(pairAddress);

        if (tokenAddress) {
          const stillTracked = Array
            .from(this.tokensByPair.values())
            .some((token) => token.tokenAddress === tokenAddress);

          if (!stillTracked) {
            this.socialByToken.delete(tokenAddress);
          }
        }
      }
    }
  }

  async #refreshGeckoLiquidity(force = false) {
    try {
      this.geckoLiquidityByToken = await this.geckoClient.getTokenLiquidityMap({ maxPages: 2 });
      if (force || this.geckoLiquidityByToken.size > 0) {
        this.#log(`GeckoTerminal liquidity snapshot refreshed (${this.geckoLiquidityByToken.size} tokens)`);
      }
    } catch (error) {
      this.#log(`GeckoTerminal fallback unavailable: ${error.message}`);
    }
  }

  #logAlert(emoji, token, reason) {
    const message = `${emoji} ${token.name} (${token.symbol}) - Score: ${token.score} - Volume: ${formatUsdCompact(token.volume.m5)} - Reason: ${reason}`;
    this.#log(message);
  }

  #log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

export default MemeCoinMonitor;
