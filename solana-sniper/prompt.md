# Solana Meme Coin Sniper - Implementation Prompt

## Project Overview
Build an advanced Solana meme coin monitoring and sniping system that detects tokens BEFORE they blow up.

## Data Sources (Use These APIs)

### 1. DEXScreener API (Primary - Free)
```
Base: https://api.dexscreener.com/latest/dex
Endpoints:
- GET /pairs/solana - All Solana pairs (supports orderBy=volume&limit=100)
- GET /tokens/{tokenAddress} - Token pair data
- GET /pairs/{chain}/{pairAddress} - Specific pair
```

### 2. GeckoTerminal API (Secondary - Free)
```
Base: https://api.geckoterminal.com/api/v2
Endpoints:
- GET /networks/solana/pools - Pool data
- GET /networks/solana/tokens - Token data
- GET /networks/solana/pools/ohlcv - Price history
```

### 3. PumpPortal API (For pump.fun tokens)
```
Base: https://api.pumpportal.funapi.com
Endpoints:
- Get tokens (newly created tokens)
- Get token data by address
```

## Key Features to Implement

### A. Token Discovery Engine
1. **New Pair Detection**
   - Poll DEXScreener for newest pairs on Solana
   - Filter for pairs created < 1 hour ago
   - Track: pairAddress, tokenAddress, liquidity, creation time

2. **Volume Spike Detection**
   - Calculate volume changes over 5min, 15min, 1hr windows
   - ALERT thresholds:
     - 5x volume in 5min = 🔥 HIGH
     - 10x volume in 5min = 🚀 MOONSHOT
     - 3x volume in 15min = ⚡ ACTIVE

3. **Liquidity Tracking**
   - Monitor liquidity changes
   - Alert when liquidity > $10K (tradeable)
   - Alert when liquidity > $30K (solid)

### B. Scoring System (0-100)
Create a scoring algorithm:

```
Score = (Volume Score) + (Liquidity Score) + (Momentum Score) + (Social Score)

Volume Score (0-30):
- 5x+ in 5min = 30
- 3x+ in 5min = 20
- 2x+ in 5min = 15
- 1.5x+ in 15min = 10

Liquidity Score (0-25):
- $50K+ = 25
- $30K+ = 20
- $15K+ = 15
- $5K+ = 10

Momentum Score (0-25):
- Price up 50%+ in 1hr = 25
- Price up 30%+ in 1hr = 20
- Price up 15%+ in 1hr = 15
- Buy/Sell ratio > 70% = 10

Social Score (0-20):
- Twitter mentions trending = 20 (if API available)
- Telegram group detected = 10
- Boost count high = 10
```

### C. Real-Time Monitoring
1. **Polling Loop**
   - Poll every 30 seconds for new pairs
   - Poll every 10 seconds for volume changes on hot tokens
   - Keep top 50 tokens in memory for comparison

2. **Alert System**
   - Console alerts with emoji indicators
   - Format: `[TIMESTAMP] 🚀 TOKEN_NAME (SYMBOL) - Score: XX - Volume: $XXK - Reason: XXXXXX`

### D. Display Dashboard
Create a web dashboard (HTML) showing:
1. **LIVE HYPE** - Tokens with score > 70
2. **WATCH LIST** - Tokens with score 50-70
3. **NEW PAIRS** - Just launched tokens
4. **Details per token:**
   - Token name, symbol, address
   - Current price, 24h change
   - Volume (5m, 1h, 24h)
   - Liquidity
   - Buy/Sell ratio
   - Score breakdown
   - Link to DEXScreener

## Technical Implementation

### File Structure
```
/root/khedma/solana-sniper/
├── sniper.js          # Main monitoring engine
├── api/
│   ├── dexscreener.js
│   ├── geckoterminal.js
│   └── pumpfun.js
├── analyzer/
│   └── scoring.js    # Scoring algorithm
├── monitor.js        # Polling loop
├── index.js          # Entry point + web dashboard
└── package.json
```

### Dashboard UI
- Clean dark theme
- Real-time updating table
- Color-coded scores (green/yellow/red)
- Click to expand details
- Auto-refresh every 10 seconds

## Requirements
1. Use only FREE APIs (DEXScreener, GeckoTerminal)
2. Implement scoring algorithm as specified
3. Create functional web dashboard
4. Handle API rate limits gracefully
5. Log all alerts to console with timestamps

## Output
Deliver a working Node.js application that:
1. Runs and monitors Solana meme coins
2. Shows live dashboard on port 3000
3. Scores and ranks tokens in real-time
4. Alerts on high-opportunity tokens

Start implementing in /root/khedma/solana-sniper/