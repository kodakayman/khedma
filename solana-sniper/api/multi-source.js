// Multi-source API for maximum token coverage

export class MultiSourceClient {
  constructor() {
    this.cache = null;
    this.cacheTime = 0;
    this.CACHE_TTL = 60000;
  }

  async getSolanaPairs(options = {}) {
    const { limit = 300 } = options;
    const now = Date.now();

    if (this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.cache.slice(0, limit);
    }

    let allTokens = [];

    // 1. GeckoTerminal - fetch 10 pages = 200 tokens
    for (let page = 1; page <= 10; page++) {
      try {
        const geckoRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools?page=${page}`);
        const geckoData = await geckoRes.json();
        if (geckoData?.data?.length > 0) {
          const geckoTokens = this.parseGecko(geckoData.data);
          allTokens = [...allTokens, ...geckoTokens];
        } else {
          break;
        }
      } catch (e) {
        console.log(`[MultiSource] GeckoTerminal page ${page} failed: ${e.message}`);
        break;
      }
    }
    console.log(`[MultiSource] GeckoTerminal total: ${allTokens.length} tokens`);

    // 2. DEXScreener Boosts - trending now!
    try {
      const dexRes = await fetch('https://api.dexscreener.com/token-boosts/latest/v1');
      const dexData = await dexRes.json();
      if (Array.isArray(dexData)) {
        const dexTokens = this.parseDexscreener(dexData);
        allTokens = [...allTokens, ...dexTokens];
        console.log(`[MultiSource] DEXScreener: ${dexTokens.length} boosted tokens`);
      }
    } catch (e) {
      console.log(`[MultiSource] DEXScreener failed: ${e.message}`);
    }

    // Deduplicate
    if (allTokens.length > 0) {
      const seen = new Set();
      allTokens = allTokens.filter(t => {
        const key = (t.baseToken?.address || t.tokenAddress || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      this.cache = allTokens;
      this.cacheTime = now;
      console.log(`[MultiSource] TOTAL: ${allTokens.length} unique tokens`);
      return allTokens.slice(0, limit);
    }

    throw new Error('No data from any source');
  }

  parseGecko(data) {
    if (!Array.isArray(data)) return [];
    return data.map(pool => {
      const attrs = pool?.attributes || {};
      const rel = pool?.relationships || {};
      const getAddr = (id) => {
        if (!id) return null;
        const idx = id.indexOf('_');
        return idx === -1 ? id : id.slice(idx + 1);
      };
      const baseId = rel?.base_token?.data?.id;
      const name = attrs.name || '';
      const [baseSym] = name.split('/').map(s => s?.trim() || '');
      
      return {
        pairAddress: attrs.address,
        baseToken: { address: getAddr(baseId), symbol: baseSym, name: baseSym },
        quoteToken: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
        priceUsd: Number(attrs.base_token_price_usd) || 0,
        liquidity: { usd: Number(attrs.reserve_in_usd) || 0 },
        volume: { m5: Number(attrs.volume_usd?.m5) || 0, h1: 0, h24: Number(attrs.volume_usd?.h24) || 0 },
        txns: { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 } },
        priceChange: { m5: 0, h1: 0, h24: Number(attrs.price_change_percentage?.h24) || 0 },
        pairCreatedAt: attrs.pool_created_at,
        url: `https://dexscreener.com/solana/${attrs.address}`,
        dexId: 'geckoterminal'
      };
    });
  }

  parseDexscreener(data) {
    if (!Array.isArray(data)) return [];
    return data.map(token => {
      const addr = token.tokenAddress || '';
      const url = token.url || '';
      const pairAddr = url.includes('/solana/') ? url.split('/solana/')[1] : '';
      const sym = token.description?.split(' ')[0]?.replace('$','') || 'UNKNOWN';
      return {
        pairAddress: pairAddr,
        baseToken: { address: addr, symbol: sym, name: sym },
        quoteToken: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
        priceUsd: 0, liquidity: { usd: 0 }, volume: { m5: 0, h1: 0, h24: 0 },
        txns: { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 } },
        priceChange: { m5: 0, h1: 0, h24: 0 },
        pairCreatedAt: '',
        url: url,
        dexId: 'dexscreener-boost',
        isBoosted: true
      };
    });
  }

  async getPair() { return null; }
}

export default MultiSourceClient;
