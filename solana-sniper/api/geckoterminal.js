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

export class GeckoTerminalClient {
  constructor({ timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_RETRIES } = {}) {
    this.baseUrl = 'https://api.geckoterminal.com/api/v2';
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.headers = {
      'User-Agent': 'solana-meme-sniper-monitor/1.0',
    };
  }

  async #request(path, params = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const url = buildUrl(this.baseUrl, path, params);
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
        const shouldRetry = !status || status === 429 || status >= 500;

        if (!shouldRetry || attempt === this.maxRetries) {
          break;
        }

        const retryAfterSeconds = Number(error?.retryAfter);
        const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : 600 * (2 ** attempt);

        await sleep(retryDelay + Math.floor(Math.random() * 250));
      }
    }

    throw lastError;
  }

  async getSolanaPools({ page = 1 } = {}) {
    const data = await this.#request('/networks/solana/pools', { page });
    return Array.isArray(data?.data) ? data.data : [];
  }

  async getTokenLiquidityMap({ maxPages = 1 } = {}) {
    const map = new Map();

    for (let page = 1; page <= maxPages; page += 1) {
      const pools = await this.getSolanaPools({ page });

      if (pools.length === 0) {
        break;
      }

      for (const pool of pools) {
        const attrs = pool?.attributes ?? {};
        const rel = pool?.relationships ?? {};
        const reserveInUsd = toNumber(attrs.reserve_in_usd);

        const baseTokenAddress = extractAddress(rel?.base_token?.data?.id);
        const quoteTokenAddress = extractAddress(rel?.quote_token?.data?.id);
        const addresses = [baseTokenAddress, quoteTokenAddress].filter(Boolean);

        for (const address of addresses) {
          const prev = map.get(address);
          if (!prev || reserveInUsd > prev.reserveInUsd) {
            map.set(address, {
              reserveInUsd,
              poolAddress: attrs.address ?? null,
              fdvUsd: toNumber(attrs.fdv_usd),
              marketCapUsd: toNumber(attrs.market_cap_usd),
            });
          }
        }
      }

      if (pools.length < 20) {
        break;
      }
    }

    return map;
  }
}

export default GeckoTerminalClient;
