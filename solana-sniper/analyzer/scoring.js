import TwitterClient from '../api/twitter.js';

const SOCIAL_CACHE_TTL_MS = 5 * 60 * 1000;
const SOCIAL_ERROR_CACHE_TTL_MS = SOCIAL_CACHE_TTL_MS;
const twitterClient = new TwitterClient();
const socialCache = new Map();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + toNumber(value), 0);
  return sum / values.length;
}

function normalizeSentimentCounts(sentiment) {
  return {
    positive: toNumber(sentiment?.positive),
    negative: toNumber(sentiment?.negative),
    neutral: toNumber(sentiment?.neutral),
  };
}

function buildSocialCacheKey(symbol, tokenName) {
  const safeSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
  const safeName = typeof tokenName === 'string' ? tokenName.trim().toLowerCase() : '';

  if (!safeSymbol && !safeName) return '';
  return `${safeSymbol}::${safeName}`;
}

function createEmptySocialScore({
  symbol,
  tokenName,
  now = Date.now(),
  reason = 'Twitter/X data unavailable',
  rateLimited = false,
} = {}) {
  return {
    socialScore: 0,
    mentionCount: 0,
    sentimentScore: 0,
    sentiment: {
      positive: 0,
      negative: 0,
      neutral: 0,
    },
    volumeScore: 0,
    sentimentComponentScore: 0,
    symbol: typeof symbol === 'string' ? symbol : '',
    tokenName: typeof tokenName === 'string' ? tokenName : '',
    rateLimited,
    unavailable: true,
    reason,
    updatedAt: now,
  };
}

function volumeScoreFromMentions(mentionCount) {
  const mentions = toNumber(mentionCount);
  if (mentions >= 100) return 10;
  if (mentions >= 50) return 8;
  if (mentions >= 25) return 6;
  if (mentions >= 12) return 4;
  if (mentions >= 5) return 2;
  return 0;
}

function sentimentScoreFromSignal(sentimentScore, sentiment) {
  const normalized = clamp(toNumber(sentimentScore), -1, 1);
  const positive = toNumber(sentiment?.positive);
  const negative = toNumber(sentiment?.negative);
  const total = positive + negative + toNumber(sentiment?.neutral);

  if (total === 0) return 0;

  const ratio = (positive - negative) / Math.max(1, positive + negative);
  const blended = (normalized + ratio) / 2;

  if (blended >= 0.65) return 10;
  if (blended >= 0.35) return 8;
  if (blended >= 0.1) return 6;
  if (blended >= -0.2) return 3;
  return 0;
}

function calculateVolumeMetrics(current, history = [], now = Date.now()) {
  const volume5m = toNumber(current?.volume5m);
  const volume1h = toNumber(current?.volume1h);

  const recentHistory = history.filter((entry) => now - toNumber(entry.timestamp) <= 15 * 60 * 1000);
  const olderFiveMinHistory = history.filter((entry) => {
    const age = now - toNumber(entry.timestamp);
    return age > 5 * 60 * 1000 && age <= 60 * 60 * 1000;
  });

  const baseline5m = average(olderFiveMinHistory.map((entry) => toNumber(entry.volume5m)))
    || (volume1h > 0 ? volume1h / 12 : 0)
    || 1;

  const avgRecent5m = average(recentHistory.map((entry) => toNumber(entry.volume5m))) || volume5m;
  const estimated15mVolume = avgRecent5m * 3;

  const older15mHistory = history.filter((entry) => {
    const age = now - toNumber(entry.timestamp);
    return age > 15 * 60 * 1000 && age <= 60 * 60 * 1000;
  });

  const baseline15m = average(older15mHistory.map((entry) => toNumber(entry.volume5m))) * 3
    || (volume1h > 0 ? volume1h / 4 : 0)
    || (baseline5m * 3)
    || 1;

  const fiveMinuteSpike = volume5m / Math.max(1, baseline5m);
  const fifteenMinuteSpike = estimated15mVolume / Math.max(1, baseline15m);

  return {
    volume5m,
    volume1h,
    fiveMinuteSpike,
    fifteenMinuteSpike,
  };
}

export function calculateVolumeScore(metrics) {
  const fiveMinuteSpike = toNumber(metrics?.fiveMinuteSpike);
  const fifteenMinuteSpike = toNumber(metrics?.fifteenMinuteSpike);

  if (fiveMinuteSpike >= 5) return 30;
  if (fiveMinuteSpike >= 3) return 20;
  if (fiveMinuteSpike >= 2) return 15;
  if (fifteenMinuteSpike >= 1.5) return 10;

  return 0;
}

export function calculateLiquidityScore(liquidityUsd) {
  const liquidity = toNumber(liquidityUsd);

  if (liquidity >= 50_000) return 25;
  if (liquidity >= 30_000) return 20;
  if (liquidity >= 15_000) return 15;
  if (liquidity >= 5_000) return 10;

  return 0;
}

export function calculateMomentumScore(priceChange1h, buys, sells) {
  const change = toNumber(priceChange1h);
  const buyCount = toNumber(buys);
  const sellCount = toNumber(sells);
  const totalTrades = buyCount + sellCount;
  const buyRatio = totalTrades > 0 ? (buyCount / totalTrades) * 100 : 0;

  let priceScore = 0;
  if (change >= 50) {
    priceScore = 25;
  } else if (change >= 30) {
    priceScore = 20;
  } else if (change >= 15) {
    priceScore = 15;
  }

  const ratioBonus = buyRatio > 70 ? 10 : 0;
  const momentumScore = Math.min(25, priceScore + ratioBonus);

  return {
    momentumScore,
    buyRatio,
  };
}

export async function calculateSocialScore({
  symbol,
  tokenName,
  now = Date.now(),
  forceRefresh = false,
  twitterClient: client = twitterClient,
} = {}) {
  const cacheKey = buildSocialCacheKey(symbol, tokenName);

  if (!cacheKey) {
    return createEmptySocialScore({
      symbol,
      tokenName,
      now,
      reason: 'Missing token symbol and token name',
    });
  }

  const cached = socialCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return {
      ...cached.value,
      cached: true,
    };
  }

  try {
    const twitterData = await client.searchRecentTweets({ symbol, tokenName });
    const mentionCount = toNumber(twitterData?.mentionCount);
    const sentiment = normalizeSentimentCounts(twitterData?.sentiment);
    const sentimentScore = clamp(toNumber(twitterData?.sentimentScore), -1, 1);

    if (twitterData?.unavailable) {
      if (twitterData?.rateLimited && cached?.value) {
        return {
          ...cached.value,
          stale: true,
          cached: true,
          rateLimited: true,
          reason: twitterData?.reason || cached.value.reason,
          updatedAt: now,
        };
      }

      const fallback = createEmptySocialScore({
        symbol,
        tokenName,
        now,
        reason: twitterData?.reason || 'Twitter/X data unavailable',
        rateLimited: Boolean(twitterData?.rateLimited),
      });

      socialCache.set(cacheKey, {
        value: fallback,
        expiresAt: now + SOCIAL_ERROR_CACHE_TTL_MS,
      });
      return fallback;
    }

    const volumeScore = volumeScoreFromMentions(mentionCount);
    const sentimentComponentScore = sentimentScoreFromSignal(sentimentScore, sentiment);
    const socialScore = Math.min(20, volumeScore + sentimentComponentScore);

    const result = {
      socialScore,
      mentionCount,
      sentimentScore,
      sentiment,
      volumeScore,
      sentimentComponentScore,
      symbol: typeof symbol === 'string' ? symbol : '',
      tokenName: typeof tokenName === 'string' ? tokenName : '',
      rateLimited: false,
      unavailable: false,
      query: twitterData?.query || '',
      tweetCount: toNumber(twitterData?.tweetCount),
      reason: '',
      updatedAt: now,
    };

    socialCache.set(cacheKey, {
      value: result,
      expiresAt: now + SOCIAL_CACHE_TTL_MS,
    });

    return result;
  } catch (error) {
    if (cached?.value) {
      return {
        ...cached.value,
        stale: true,
        cached: true,
        reason: error?.message || cached.value.reason,
        updatedAt: now,
      };
    }

    const fallback = createEmptySocialScore({
      symbol,
      tokenName,
      now,
      reason: error?.message || 'Twitter/X request failed',
    });

    socialCache.set(cacheKey, {
      value: fallback,
      expiresAt: now + SOCIAL_ERROR_CACHE_TTL_MS,
    });

    return fallback;
  }
}

export function scoreToken({ current, history = [], social = null, now = Date.now() }) {
  const volumeMetrics = calculateVolumeMetrics(current, history, now);
  const volumeScore = calculateVolumeScore(volumeMetrics);
  const liquidityScore = calculateLiquidityScore(current?.liquidityUsd);
  const momentum = calculateMomentumScore(current?.priceChange1h, current?.buys5m, current?.sells5m);
  const socialData = social && typeof social === 'object'
    ? social
    : createEmptySocialScore({ now, reason: 'Social score pending refresh' });
  const socialScore = clamp(toNumber(socialData?.socialScore), 0, 20);
  const socialMentions = toNumber(socialData?.mentionCount);
  const socialSentiment = normalizeSentimentCounts(socialData?.sentiment);
  const socialSentimentScore = clamp(toNumber(socialData?.sentimentScore), -1, 1);
  const socialVolumeScore = clamp(toNumber(socialData?.volumeScore), 0, 10);
  const socialSentimentComponentScore = clamp(toNumber(socialData?.sentimentComponentScore), 0, 10);

  const total = Math.min(100, volumeScore + liquidityScore + momentum.momentumScore + socialScore);

  const reasons = [];
  if (volumeMetrics.fiveMinuteSpike >= 10) reasons.push('10x+ volume spike in 5m');
  else if (volumeMetrics.fiveMinuteSpike >= 5) reasons.push('5x+ volume spike in 5m');
  else if (volumeMetrics.fiveMinuteSpike >= 3) reasons.push('3x+ volume spike in 5m');
  else if (volumeMetrics.fifteenMinuteSpike >= 1.5) reasons.push('1.5x+ volume in 15m');

  if (toNumber(current?.liquidityUsd) >= 30_000) reasons.push('liquidity above $30K');
  else if (toNumber(current?.liquidityUsd) >= 10_000) reasons.push('liquidity above $10K');

  if (toNumber(current?.priceChange1h) >= 30) reasons.push('strong 1h price momentum');
  if (momentum.buyRatio > 70) reasons.push('buy pressure > 70%');

  if (socialScore >= 15) {
    reasons.push('strong Twitter/X buzz');
  } else if (socialMentions >= 10) {
    reasons.push('Twitter/X mentions building');
  }

  if (socialScore === 0) {
    if (socialData?.rateLimited) {
      reasons.push('social score held due to Twitter rate limit');
    } else if (socialData?.unavailable) {
      reasons.push('social score unavailable');
    } else {
      reasons.push('limited Twitter/X social signal');
    }
  }

  return {
    total,
    breakdown: {
      volumeScore,
      liquidityScore,
      momentumScore: momentum.momentumScore,
      socialScore,
      socialVolumeScore,
      socialSentimentScore: socialSentimentComponentScore,
    },
    metrics: {
      fiveMinuteSpike: volumeMetrics.fiveMinuteSpike,
      fifteenMinuteSpike: volumeMetrics.fifteenMinuteSpike,
      buySellRatio: momentum.buyRatio,
      socialMentions,
      socialSentimentScore,
      socialSentiment,
    },
    reasons,
  };
}
