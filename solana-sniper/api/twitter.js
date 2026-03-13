import 'dotenv/config';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_MAX_RESULTS = 50;
const RATE_LIMIT_BUFFER_MS = 1_000;

const POSITIVE_WORDS = new Set([
  'bullish',
  'moon',
  'mooning',
  'pump',
  'pumping',
  'send',
  'rocket',
  'green',
  'buy',
  'gem',
  'alpha',
  'breakout',
  'surge',
  'win',
  'winning',
  'up',
  'uptrend',
]);

const NEGATIVE_WORDS = new Set([
  'bearish',
  'dump',
  'dumping',
  'rug',
  'rugged',
  'scam',
  'sell',
  'red',
  'down',
  'crash',
  'rekt',
  'avoid',
  'warning',
  'fake',
  'dead',
  'loss',
  'losing',
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTerm(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteIfNeeded(term) {
  if (!term) return '';
  return term.includes(' ') ? `"${term}"` : term;
}

function buildSearchQuery(symbol, tokenName) {
  const cleanSymbol = normalizeTerm(symbol);
  const cleanTokenName = normalizeTerm(tokenName);

  const terms = [];
  if (cleanSymbol) {
    terms.push(quoteIfNeeded(cleanSymbol));
  }

  if (cleanTokenName && cleanTokenName.toLowerCase() !== cleanSymbol.toLowerCase()) {
    terms.push(quoteIfNeeded(cleanTokenName));
  }

  if (terms.length === 0) {
    return '';
  }

  return `${terms.join(' OR ')} -is:retweet`;
}

function classifySentiment(text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter(Boolean);

  let positive = 0;
  let negative = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positive += 1;
    if (NEGATIVE_WORDS.has(word)) negative += 1;
  }

  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

function parseRateLimitDelayMs(response, attempt) {
  const retryAfterSeconds = toNumber(response.headers.get('retry-after'));
  if (retryAfterSeconds > 0) {
    return Math.ceil(retryAfterSeconds * 1_000);
  }

  const resetAtSeconds = toNumber(response.headers.get('x-rate-limit-reset'));
  if (resetAtSeconds > 0) {
    const delayMs = (resetAtSeconds * 1_000) - Date.now() + RATE_LIMIT_BUFFER_MS;
    if (delayMs > 0) {
      return delayMs;
    }
  }

  return 1_000 * (2 ** attempt);
}

function buildUnavailableResult({
  query = '',
  reason = 'Twitter API unavailable',
  rateLimited = false,
} = {}) {
  return {
    query,
    mentionCount: 0,
    sentiment: {
      positive: 0,
      negative: 0,
      neutral: 0,
    },
    sentimentScore: 0,
    tweetCount: 0,
    unavailable: true,
    rateLimited,
    reason,
  };
}

export class TwitterClient {
  constructor({
    bearerToken = decodeURIComponent(process.env.TWITTER_BEARER_TOKEN || ''),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_RETRIES,
  } = {}) {
    this.baseUrl = 'https://api.twitter.com/2';
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.bearerToken = typeof bearerToken === 'string' ? bearerToken.trim() : '';
    this.rateLimitedUntil = 0;
    this.headers = {
      'User-Agent': 'solana-meme-sniper-monitor/1.0',
      Authorization: `Bearer ${this.bearerToken}`,
    };
  }

  isConfigured() {
    return this.bearerToken.length > 0;
  }

  async #request(path, params = {}) {
    if (!this.isConfigured()) {
      const error = new Error('TWITTER_BEARER_TOKEN is not configured');
      error.status = 401;
      throw error;
    }

    if (this.rateLimitedUntil > Date.now()) {
      const error = new Error('Twitter API is rate-limited');
      error.status = 429;
      error.retryAfterMs = this.rateLimitedUntil - Date.now();
      throw error;
    }

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const url = new URL(`${this.baseUrl}${path}`);
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
          }
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.status === 429) {
          const delayMs = parseRateLimitDelayMs(response, attempt);
          this.rateLimitedUntil = Date.now() + delayMs;

          const error = new Error(`Twitter request rate-limited (429), retry in ${Math.ceil(delayMs / 1000)}s`);
          error.status = 429;
          error.retryAfterMs = delayMs;
          throw error;
        }

        if (!response.ok) {
          const error = new Error(`Twitter request failed with ${response.status}`);
          error.status = response.status;
          error.retryAfter = response.headers.get('retry-after');
          throw error;
        }

        this.rateLimitedUntil = 0;
        return await response.json();
      } catch (error) {
        lastError = error;
        const status = toNumber(error?.status);
        const shouldRetry = !status || status === 429 || status >= 500;

        if (!shouldRetry || attempt === this.maxRetries) {
          break;
        }

        const retryAfterMs = toNumber(error?.retryAfterMs);
        const retryDelay = retryAfterMs > 0
          ? retryAfterMs
          : 600 * (2 ** attempt);

        await sleep(retryDelay + Math.floor(Math.random() * 250));
      }
    }

    throw lastError;
  }

  async searchRecentTweets({ symbol, tokenName, maxResults = DEFAULT_MAX_RESULTS } = {}) {
    const query = buildSearchQuery(symbol, tokenName);

    if (!query) {
      return buildUnavailableResult({
        query,
        reason: 'Missing token symbol and name for Twitter search',
      });
    }

    if (!this.isConfigured()) {
      return buildUnavailableResult({
        query,
        reason: 'TWITTER_BEARER_TOKEN not configured',
      });
    }

    try {
      const max = clamp(toNumber(maxResults) || DEFAULT_MAX_RESULTS, 10, 100);
      const startTime = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
      const payload = await this.#request('/tweets/search/recent', {
        query,
        max_results: String(max),
        start_time: startTime,
        'tweet.fields': 'public_metrics,text',
      });

      const tweets = Array.isArray(payload?.data) ? payload.data : [];
      const mentionCount = toNumber(payload?.meta?.result_count) || tweets.length;

      const sentiment = {
        positive: 0,
        negative: 0,
        neutral: 0,
      };

      let weightedNetSentiment = 0;

      for (const tweet of tweets) {
        const tweetSentiment = classifySentiment(tweet?.text);
        sentiment[tweetSentiment] += 1;

        const metrics = tweet?.public_metrics ?? {};
        const engagement = toNumber(metrics.like_count)
          + toNumber(metrics.retweet_count)
          + toNumber(metrics.reply_count)
          + toNumber(metrics.quote_count);

        const weight = 1 + Math.min(3, engagement / 20);
        if (tweetSentiment === 'positive') weightedNetSentiment += weight;
        if (tweetSentiment === 'negative') weightedNetSentiment -= weight;
      }

      const tweetCount = tweets.length;
      const normalizedSentiment = tweetCount > 0
        ? clamp((weightedNetSentiment / tweetCount) / 2, -1, 1)
        : 0;

      return {
        query,
        mentionCount,
        sentiment,
        sentimentScore: normalizedSentiment,
        tweetCount,
        unavailable: false,
        rateLimited: false,
      };
    } catch (error) {
      if (toNumber(error?.status) === 429) {
        return buildUnavailableResult({
          query,
          reason: error.message,
          rateLimited: true,
        });
      }

      throw error;
    }
  }
}

export default TwitterClient;
