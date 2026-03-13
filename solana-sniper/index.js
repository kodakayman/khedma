import { createServer } from 'node:http';
import MemeCoinMonitor from './monitor.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(html),
  });
  res.end(html);
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solana Meme Sniper Monitor</title>
  <style>
    :root {
      --bg: #0c1017;
      --panel: #151b24;
      --panel-border: #283345;
      --text: #e7ecf4;
      --muted: #8e99aa;
      --score-green: #17c964;
      --score-yellow: #f5a524;
      --score-red: #f31260;
      --accent: #2dd4bf;
      --row: #111824;
      --row-alt: #0f1520;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: radial-gradient(circle at top right, #1a2434, var(--bg) 52%);
      color: var(--text);
      min-height: 100vh;
    }

    .container {
      width: min(1300px, 94vw);
      margin: 28px auto;
      display: grid;
      gap: 16px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px;
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      background: linear-gradient(130deg, #141c29, #101723);
      gap: 12px;
      flex-wrap: wrap;
    }

    .title {
      margin: 0;
      font-size: 1.45rem;
      letter-spacing: 0.02em;
    }

    .sub {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 0.93rem;
    }

    .stats {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pill {
      border: 1px solid var(--panel-border);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 0.85rem;
      color: var(--muted);
      background: rgba(19, 28, 42, 0.8);
    }

    .section {
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      background: var(--panel);
      overflow: hidden;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 14px 16px;
      border-bottom: 1px solid var(--panel-border);
      background: #141a25;
      gap: 12px;
      flex-wrap: wrap;
    }

    .section-title {
      margin: 0;
      font-size: 1rem;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .section-meta {
      margin: 0;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 960px;
    }

    th,
    td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #263244;
      font-size: 0.88rem;
      vertical-align: top;
    }

    th {
      background: #161f2d;
      color: #9aacc3;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.74rem;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .token-row {
      cursor: pointer;
      background: var(--row);
      transition: background 0.15s ease;
    }

    .token-row:nth-child(4n + 1),
    .token-row:nth-child(4n + 2) {
      background: var(--row-alt);
    }

    .token-row:hover,
    .token-row.open {
      background: #1c2838;
    }

    .score {
      font-weight: 700;
      border-radius: 8px;
      padding: 3px 7px;
      display: inline-block;
      min-width: 44px;
      text-align: center;
    }

    .score-high {
      color: #052913;
      background: var(--score-green);
    }

    .score-mid {
      color: #2e2104;
      background: var(--score-yellow);
    }

    .score-low {
      color: #3b0117;
      background: var(--score-red);
    }

    .positive {
      color: var(--score-green);
      font-weight: 600;
    }

    .negative {
      color: #ff5b89;
      font-weight: 600;
    }

    .muted {
      color: var(--muted);
    }

    .detail-row {
      display: none;
      background: #101923;
    }

    .detail-row.open {
      display: table-row;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }

    .detail-box {
      border: 1px solid #2a384e;
      border-radius: 10px;
      padding: 10px;
      background: #111d2a;
      overflow-wrap: anywhere;
    }

    .detail-label {
      display: block;
      color: var(--muted);
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 5px;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .empty {
      color: var(--muted);
      padding: 24px;
      text-align: center;
      font-style: italic;
    }

    @media (max-width: 780px) {
      .container {
        width: 96vw;
      }

      .title {
        font-size: 1.2rem;
      }

      .section-title {
        font-size: 0.92rem;
      }
    }
  </style>
</head>
<body>
  <main class="container">
    <section class="header">
      <div>
        <h1 class="title">Solana Meme Coin Sniper Monitor</h1>
        <p class="sub">Polling DEXScreener (30s) + Hot Tokens (10s) + GeckoTerminal fallback + Twitter/X social (60s)</p>
      </div>
      <div class="stats" id="stats"></div>
    </section>

    <section class="section">
      <header class="section-head">
        <h2 class="section-title">LIVE HYPE</h2>
        <p class="section-meta">Score > 70</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Score</th>
              <th>Price</th>
              <th>24h</th>
              <th>Volume 5m</th>
              <th>Volume 1h</th>
              <th>Liquidity</th>
              <th>Buy/Sell</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody id="live-hype-body"></tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <header class="section-head">
        <h2 class="section-title">WATCH LIST</h2>
        <p class="section-meta">Score 50-70</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Score</th>
              <th>Price</th>
              <th>24h</th>
              <th>Volume 5m</th>
              <th>Volume 1h</th>
              <th>Liquidity</th>
              <th>Buy/Sell</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody id="watch-list-body"></tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <header class="section-head">
        <h2 class="section-title">NEW PAIRS</h2>
        <p class="section-meta">Pairs launched within last hour</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Score</th>
              <th>Price</th>
              <th>24h</th>
              <th>Volume 5m</th>
              <th>Volume 1h</th>
              <th>Liquidity</th>
              <th>Buy/Sell</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody id="new-pairs-body"></tbody>
        </table>
      </div>
    </section>
  </main>

  <script>
    const statsEl = document.getElementById('stats');

    function esc(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function usd(value) {
      const num = Number(value || 0);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(num);
    }

    function price(value) {
      const num = Number(value || 0);
      if (num >= 1) {
        return '$' + num.toFixed(4);
      }
      if (num >= 0.01) {
        return '$' + num.toFixed(6);
      }
      if (num <= 0) return '$0.00';
      return '$' + num.toPrecision(4);
    }

    function pct(value) {
      const num = Number(value || 0);
      const cls = num >= 0 ? 'positive' : 'negative';
      const sign = num >= 0 ? '+' : '';
      return '<span class="' + cls + '">' + sign + num.toFixed(2) + '%</span>';
    }

    function scoreClass(score) {
      const num = Number(score || 0);
      if (num > 70) return 'score-high';
      if (num >= 50) return 'score-mid';
      return 'score-low';
    }

    function age(createdAt) {
      const ts = Number(createdAt || 0);
      const delta = Math.max(0, Date.now() - ts);
      const minutes = Math.floor(delta / 60000);
      if (minutes < 60) return minutes + 'm';
      const hours = Math.floor(minutes / 60);
      const rem = minutes % 60;
      return hours + 'h ' + rem + 'm';
    }

    function renderRows(targetId, tokens, emptyLabel) {
      const target = document.getElementById(targetId);

      if (!Array.isArray(tokens) || tokens.length === 0) {
        target.innerHTML = '<tr><td colspan="9" class="empty">' + esc(emptyLabel) + '</td></tr>';
        return;
      }

      target.innerHTML = tokens.map((token, idx) => {
        const detailId = targetId + '-detail-' + idx;
        const ratio = Number(token.buySellRatio || 0);
        const socialScore = Number(token.scoreBreakdown?.socialScore || 0);
        const socialVolumeScore = Number(token.scoreBreakdown?.socialVolumeScore || 0);
        const socialSentimentComponent = Number(token.scoreBreakdown?.socialSentimentScore || 0);
        const twitterMentions = Number(token.socialData?.mentionCount ?? token.scoreMetrics?.socialMentions ?? 0);
        const sentiment = token.socialData?.sentiment || token.scoreMetrics?.socialSentiment || {};
        const positiveMentions = Number(sentiment.positive || 0);
        const negativeMentions = Number(sentiment.negative || 0);
        const neutralMentions = Number(sentiment.neutral || 0);
        const socialStatus = token.socialData?.rateLimited
          ? 'rate-limited (cached)'
          : (token.socialData?.unavailable ? 'unavailable' : 'live');

        return '\n          <tr class="token-row" data-detail="' + detailId + '">\n            <td>' + esc(token.name) + ' <span class="muted">(' + esc(token.symbol) + ')</span></td>\n            <td><span class="score ' + scoreClass(token.score) + '">' + Number(token.score || 0) + '</span></td>\n            <td>' + esc(price(token.priceUsd)) + '</td>\n            <td>' + pct(token.priceChange?.h24) + '</td>\n            <td>' + esc(usd(token.volume?.m5)) + '</td>\n            <td>' + esc(usd(token.volume?.h1)) + '</td>\n            <td>' + esc(usd(token.liquidityUsd)) + '</td>\n            <td>' + ratio.toFixed(1) + '% / ' + (100 - ratio).toFixed(1) + '%</td>\n            <td>' + esc(age(token.pairCreatedAt)) + '</td>\n          </tr>\n          <tr class="detail-row" id="' + detailId + '">\n            <td colspan="9">\n              <div class="detail-grid">\n                <div class="detail-box">\n                  <span class="detail-label">Token Address</span>\n                  <div>' + esc(token.tokenAddress) + '</div>\n                </div>\n                <div class="detail-box">\n                  <span class="detail-label">Pair Address</span>\n                  <div>' + esc(token.pairAddress) + '</div>\n                </div>\n                <div class="detail-box">\n                  <span class="detail-label">Score Breakdown</span>\n                  <div>Volume: ' + Number(token.scoreBreakdown?.volumeScore || 0) + ' | Liquidity: ' + Number(token.scoreBreakdown?.liquidityScore || 0) + ' | Momentum: ' + Number(token.scoreBreakdown?.momentumScore || 0) + ' | Social: ' + socialScore + ' (Volume: ' + socialVolumeScore + ', Sentiment: ' + socialSentimentComponent + ')</div>\n                </div>\n                <div class="detail-box">\n                  <span class="detail-label">Detailed Metrics</span>\n                  <div>5m Spike: ' + Number(token.scoreMetrics?.fiveMinuteSpike || 0).toFixed(2) + 'x | 15m Spike: ' + Number(token.scoreMetrics?.fifteenMinuteSpike || 0).toFixed(2) + 'x | 24h Vol: ' + esc(usd(token.volume?.h24)) + '</div>\n                </div>\n                <div class="detail-box">\n                  <span class="detail-label">Twitter/X Mentions</span>\n                  <div>Mentions: ' + twitterMentions + ' | Sentiment: +' + positiveMentions + ' / -' + negativeMentions + ' / =' + neutralMentions + ' | Status: ' + esc(socialStatus) + '</div>\n                </div>\n                <div class="detail-box">\n                  <span class="detail-label">Why It Scored</span>\n                  <div>' + esc((token.reasons || []).join(', ') || 'No active momentum signals') + '</div>\n                </div>\n                <div class="detail-box">\n                  <span class="detail-label">DEX Link</span>\n                  <div><a href="' + esc(token.dexUrl || '#') + '" target="_blank" rel="noopener noreferrer">Open in DEXScreener</a></div>\n                </div>\n              </div>\n            </td>\n          </tr>\n        ';
      }).join('');

      target.querySelectorAll('.token-row').forEach((row) => {
        row.addEventListener('click', () => {
          row.classList.toggle('open');
          const detailRow = document.getElementById(row.dataset.detail);
          if (detailRow) {
            detailRow.classList.toggle('open');
          }
        });
      });
    }

    function renderStats(data) {
      const counts = data.counts || {};
      const updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : 'n/a';

      statsEl.innerHTML = [
        '<span class="pill">Tracked: ' + Number(counts.tracked || 0) + '</span>',
        '<span class="pill">LIVE HYPE: ' + Number(counts.liveHype || 0) + '</span>',
        '<span class="pill">WATCH: ' + Number(counts.watchList || 0) + '</span>',
        '<span class="pill">NEW: ' + Number(counts.newPairs || 0) + '</span>',
        '<span class="pill">Updated: ' + esc(updatedAt) + '</span>',
      ].join('');
    }

    async function refresh() {
      try {
        const response = await fetch('/api/tokens', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('API response ' + response.status);
        }

        const data = await response.json();
        renderStats(data);
        renderRows('live-hype-body', data.liveHype, 'No tokens above 70 yet.');
        renderRows('watch-list-body', data.watchList, 'No tokens in 50-70 range.');
        renderRows('new-pairs-body', data.newPairs, 'No newly launched pairs in memory.');
      } catch (error) {
        statsEl.innerHTML = '<span class="pill">Dashboard fetch error: ' + esc(error.message) + '</span>';
      }
    }

    refresh();
    setInterval(refresh, 10000);
  </script>
</body>
</html>`;
}

const monitor = new MemeCoinMonitor();
let server = null;

function requestHandler(req, res) {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url || '/', `http://${host}`);

  if (req.method === 'GET' && url.pathname === '/api/tokens') {
    sendJson(res, 200, monitor.getState());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      running: true,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    sendHtml(res, 200, dashboardHtml());
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function bootstrap() {
  await monitor.start();

  server = createServer(requestHandler);
  server.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] HTTP server error:`, error);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[${new Date().toISOString()}] Dashboard ready on http://${HOST}:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error(`[${new Date().toISOString()}] Failed to start monitor:`, error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    monitor.stop();
    if (!server) {
      process.exit(0);
      return;
    }

    server.close(() => {
      process.exit(0);
    });
  });
}
