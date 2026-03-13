import GeckoTerminalClient from './geckoterminal.js';

export class DualSourceClient {
  constructor() {
    this.geckoClient = new GeckoTerminalClient();
    this.cache = null;
    this.cacheTime = 0;
    this.CACHE_TTL = 60000;
  }

  async getSolanaPairs(options = {}) {
    const { limit = 100 } = options;
    const now = Date.now();

    if (this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
      console.log('[DualSource] Returning cached data');
      return this.cache.slice(0, limit);
    }

    try {
      console.log('[DualSource] Fetching from GeckoTerminal (5 pages)...');
      
      // Fetch multiple pages
      const allPools = [];
      for (let page = 1; page <= 5; page++) {
        try {
          const pools = await this.geckoClient.getSolanaPools({ page });
          if (pools && pools.length > 0) {
            allPools.push(...pools);
            console.log(`[DualSource] Page ${page}: ${pools.length} pools`);
          } else {
            break;
          }
        } catch (e) {
          console.log(`[DualSource] Page ${page} failed: ${e.message}`);
          break;
        }
      }
      
      if (allPools.length > 0) {
        const data = this.transformGeckoPools(allPools);
        this.cache = data;
        this.cacheTime = now;
        console.log(`[DualSource] Total: ${data.length} tokens`);
        return data.slice(0, limit);
      }
    } catch (err) {
      console.log(`[DualSource] Error: ${err.message}`);
    }

    if (this.cache) {
      console.log('[DualSource] Using expired cache');
      return this.cache.slice(0, limit);
    }

    throw new Error('No data available');
  }

  transformGeckoPools(pools) {
    return pools.map(pool => {
      const attrs = pool?.attributes || {};
      const rel = pool?.relationships || {};
      
      const getAddr = (id) => {
        if (!id) return null;
        const idx = id.indexOf('_');
        return idx === -1 ? id : id.slice(idx + 1);
      };
      
      const baseId = rel?.base_token?.data?.id;
      const quoteId = rel?.quote_token?.data?.id;
      const baseAddr = getAddr(baseId);
      const quoteAddr = getAddr(quoteId);
      
      const name = attrs.name || '';
      const [baseSym, quoteSym] = name.split('/').map(s => s?.trim() || '');
      
      return {
        pairAddress: attrs.address,
        baseToken: {
          address: baseAddr,
          symbol: baseSym,
          name: baseSym
        },
        quoteToken: {
          address: quoteAddr,
          symbol: quoteSym,
          name: quoteSym
        },
        priceUsd: Number(attrs.base_token_price_usd) || 0,
        liquidity: {
          usd: Number(attrs.reserve_in_usd) || 0
        },
        volume: {
          m5: Number(attrs.volume_usd?.m5) || 0,
          h1: Number(attrs.volume_usd?.h1) || 0,
          h24: Number(attrs.volume_usd?.h24) || 0
        },
        txns: {
          m5: {
            buys: Number(attrs.transactions?.m5?.buys) || 0,
            sells: Number(attrs.transactions?.m5?.sells) || 0
          },
          h1: {
            buys: Number(attrs.transactions?.h1?.buys) || 0,
            sells: Number(attrs.transactions?.h1?.sells) || 0
          }
        },
        priceChange: {
          m5: Number(attrs.price_change_percentage?.m5) || 0,
          h1: Number(attrs.price_change_percentage?.h1) || 0,
          h24: Number(attrs.price_change_percentage?.h24) || 0
        },
        pairCreatedAt: attrs.pool_created_at,
        url: `https://dexscreener.com/solana/${attrs.address}`,
        dexId: rel?.dex?.data?.id || 'unknown'
      };
    });
  }

  async getPair(pairAddress) {
    return null;
  }
}

export default DualSourceClient;
