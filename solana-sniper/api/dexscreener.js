const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function extractAddress(id) {
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  const idx = id.indexOf('_');
  return idx === -1 ? id : id.slice(idx + 1);
}

function buildUrl(baseUrl, path, params) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

/**
 * Transform GeckoTerminal pool data to DexScreener-compatible format
 */
function transformPoolToDexScreenerFormat(pool) {
  const attrs = pool?.attributes ?? {};
  const rel = pool?.relationships ?? {};

  // Extract token addresses from relationships
  const baseTokenId = rel?.base_token?.data?.id ?? '';
  const quoteTokenId = rel?.quote_token?.data?.id ?? '';
  const baseTokenAddress = extractAddress(baseTokenId);
  const quoteTokenAddress = extractAddress(quoteTokenId);

  // Parse pool name to get token symbols (format: "TOKEN_A / TOKEN_B")
  const poolName = attrs.name ?? '';
  const [baseSymbol, quoteSymbol] = poolName.split('/').map(s => s?.trim() || '');

  // Build volume object from GeckoTerminal's volume_usd
  const volumeUsd = attrs.volume_usd ?? {};
  const volume = {
    m5: toNumber(volumeUsd.m5),
    h1: toNumber(volumeUsd.h1),
    h24: toNumber(volumeUsd.h24),
  };

  // Build price change object
  const priceChangePct = attrs.price_change_percentage ?? {};
  const priceChange = {
    m5: toNumber(priceChangePct.m5),
    h1: toNumber(priceChangePct.h1),
    h24: toNumber(priceChangePct.h24),
  };

  // Build transactions object
  const transactions = attrs.transactions ?? {};
  const txs = {
    m5: {
      buys: toNumber(transactions.m5?.buys),
      sells: toNumber(transactions.m5?.sells),
    },
    h1: {
      buys: toNumber(transactions.h1?.buys),
      sells: toNumber(transactions.h1?.sells),
    },
    h24: {
      buys: toNumber(transactions.h24?.buys),
      sells: toNumber(transactions.h24?.sells),
    },
  };

  return {
    // Pair identification
    pairAddress: attrs.address ?? null,
    chainId: 'solana',
    dexId: rel?.dex?.data?.id ?? null,

    // Base token (the meme coin usually)
    baseToken: {
      address: baseTokenAddress,
      symbol: baseSymbol,
      name: baseSymbol, // GeckoTerminal doesn't provide full name, use symbol
    },

    // Quote token (usually SOL or USDC)
    quoteToken: {
      address: quoteTokenAddress,
      symbol: quoteSymbol,
      name: quoteSymbol,
    },

    // Price and market data
    priceUsd: toNumber(attrs.base_token_price_usd),
    priceNative: toNumber(attrs.base_token_price_native_currency),
    fdv: toNumber(attrs.fdv_usd),
    marketCap: toNumber(attrs.market_cap_usd),

    // Liquidity
    liquidity: {
      usd: toNumber(attrs.reserve_in_usd),
      native: toNumber(attrs.reserve_in_usd), // GeckoTerminal only provides USD
    },

    // Volume
    volume,

    // Price changes
    priceChange,

    // Transactions
    txns: txs,

    // Timestamp
    pairCreatedAt: attrs.pool_created_at ?? null,

    // Raw data for reference
    _raw: attrs,
  };
}

export class DexScreenerClient {
  constructor({ timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_RETRIES } = {}) {
    // Use GeckoTerminal as primary API
    this.geckoBaseUrl = 'https://api.geckoterminal.com/api/v2';
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.headers = {
      'User-Agent': 'solana-meme-sniper-monitor/1.0',
    };

    // Simple in-memory cache to reduce API calls
    this.cache = new Map();
    this.cacheTtlMs = 60_000; // 60 seconds cache (GeckoTerminal has rate limits)
    this.cacheMaxAge = 120_000; // Max age before forcing refresh

    // Circuit breaker for rate limiting
    this.rateLimitUntil = 0;
  }

  /**
   * Reset rate limit immediately (for testing)
   */
  resetRateLimit() {
    this.rateLimitUntil = 0;
  }

  /**
   * Check if we're in rate limit cooldown
   */
  #isRateLimited() {
    if (this.rateLimitUntil > 0 && Date.now() < this.rateLimitUntil) {
      return true;
    }
    this.rateLimitUntil = 0; // Reset if expired
    return false;
  }

  /**
   * Set rate limit cooldown
   */
  #setRateLimit(delayMs = 60_000) {
    this.rateLimitUntil = Date.now() + delayMs;
  }

  /**
   * Check if cache is valid
   */
  #isCacheValid(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTtlMs;
  }

  /**
   * Get from cache or fetch fresh data
   */
  async #getCachedOrFetch(key, fetcher, forceRefresh = false) {
    if (!forceRefresh && this.#isCacheValid(key)) {
      return this.cache.get(key).data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  async #request(path, params = {}) {
    // Check circuit breaker
    if (this.#isRateLimited()) {
      const error = new Error('GeckoTerminal rate limited (circuit breaker open)');
      error.status = 429;
      throw error;
    }

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const url = buildUrl(this.geckoBaseUrl, path, params);
        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
          const error = new Error(`GeckoTerminal request failed with ${response.status}`);
          error.status = response.status;
          error.retryAfter = response.headers.get('retry-after');
          throw error;
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        const status = error?.status;

        // If rate limited, activate circuit breaker
        if (status === 429) {
          this.#setRateLimit(60_000); // 1 minute cooldown
        }

        const shouldRetry = !status || status === 429 || status >= 500;

        if (!shouldRetry || attempt === this.maxRetries) {
          break;
        }

        const retryAfterSeconds = Number(error?.retryAfter);
        const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : 1000 * (2 ** attempt); // Longer delay between retries

        await sleep(retryDelay + Math.floor(Math.random() * 500));
      }
    }

    throw lastError;
  }

  /**
   * Get top Solana pairs by volume from GeckoTerminal
   * Returns data in DexScreener-compatible format
   */
  async getSolanaPairs({ limit = 100, orderBy = 'volume' } = {}) {
    const cacheKey = `pools_${limit}_${orderBy}`;

    // Use cache with forced refresh option
    const pools = await this.#getCachedOrFetch(cacheKey, async () => {
      const poolsList = [];
      let page = 1;
      const maxPages = Math.ceil(limit / 20); // GeckoTerminal returns 20 per page

      while (poolsList.length < limit && page <= maxPages) {
        const data = await this.#request('/networks/solana/pools', { page });
        const pagePools = Array.isArray(data?.data) ? data.data : [];

        if (pagePools.length === 0) {
          break;
        }

        poolsList.push(...pagePools.map(transformPoolToDexScreenerFormat));
        page += 1;

        // Add delay between pages to avoid rate limiting
        await sleep(200);

        // GeckoTerminal returns less than 20 when no more data
        if (pagePools.length < 20) {
          break;
        }
      }

      // Sort by volume (default: h24) to match DexScreener's orderBy
      if (orderBy === 'volume') {
        poolsList.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
      }

      return poolsList.slice(0, limit);
    }, false);

    return pools;
  }

  /**
   * Get pairs for a specific token
   */
  async getTokenPairs(tokenAddress) {
    if (!tokenAddress) return [];

    // GeckoTerminal doesn't have a direct token endpoint, so we fetch all pools
    // and filter. For efficiency, we fetch a limited number of pages.
    const allPools = await this.getSolanaPairs({ limit: 100 });

    // Filter pools where the token is either base or quote token
    return allPools.filter(pool =>
      pool.baseToken.address === tokenAddress ||
      pool.quoteToken.address === tokenAddress
    );
  }

  /**
   * Get a specific pair by address
   */
  async getPair(pairAddress, chain = 'solana') {
    if (!pairAddress) return null;

    // GeckoTerminal doesn't have a direct pool endpoint by address
    // We fetch pools and find the matching one
    const pools = await this.getSolanaPairs({ limit: 200 });
    return pools.find(pool => pool.pairAddress === pairAddress) || null;
  }
}

export default DexScreenerClient;
