// scraper.js — à mettre à la racine du repo
// Tourne via GitHub Actions, IPs Azure = pas bloqué par futbin

const https = require('https');
const fs    = require('fs');

const PLATFORM  = 'ps';
const PAGES     = 5;
const RATING_MIN = 82;
const RATING_MAX = 99;
const PRICE_MAX  = 300000;
const ERROR_RATIO = 0.82;
const MIN_PROFIT  = 300;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.futbin.com/27/players',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      timeout: 15000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseJSON(data) {
  const arr = Array.isArray(data) ? data : (data.players || data.data || []);
  return arr.map(p => ({
    id:         String(p.id || p.player_id || ''),
    name:       p.player_name || p.name || '',
    pos:        p.position || p.pos || '',
    rating:     parseInt(p.rating || p.player_rating) || 0,
    nationality: p.nationality || '',
    version:    p.version || p.card_type || 'gold',
    buy_price:  parseInt(p[PLATFORM + '_price'] || p.price) || 0,
    avg_price:  parseInt(p[PLATFORM + '_avg_price'] || p.avg_price) || 0,
    low_price:  parseInt(p[PLATFORM + '_LCPrice'] || p.lowest_price) || 0,
    photo:      `https://cdn.futbin.com/content/fifa27/img/players/${p.id}.png`,
  })).filter(p => p.buy_price > 0 && p.name);
}

function parseHTML(html) {
  const players = [];
  // Pattern data-attributes sur les <tr> futbin
  const re = /data-player-id="(\d+)"[^>]*data-player-name="([^"]+)"[^>]*data-rating="(\d+)"[^>]*data-position="([^"]+)"[^>]*data-ps-price="(\d+)"[^>]*data-avg-price="(\d+)"(?:[^>]*data-lc-price="(\d+)")?/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, id, name, rating, pos, buy, avg, lc] = m;
    if (parseInt(buy) < 100) continue;
    players.push({
      id, name, pos,
      rating: parseInt(rating),
      nationality: '', version: 'gold',
      buy_price: parseInt(buy),
      avg_price: parseInt(avg) || parseInt(buy),
      low_price: parseInt(lc || buy),
      photo: `https://cdn.futbin.com/content/fifa27/img/players/${id}.png`,
    });
  }
  return players;
}

function calcDeals(players) {
  return players.map(p => {
    const avg  = p.avg_price || p.buy_price;
    const low  = p.low_price || avg;
    const buy  = p.buy_price;
    const net  = Math.floor(avg * 0.95);
    const profit = net - buy;
    const roi    = buy > 0 ? Math.round((profit / buy) * 100) : 0;
    const margin = avg > 0 ? Math.round((profit / avg) * 100) : 0;
    const is_error = low > 0 && buy < low * ERROR_RATIO;
    return { ...p, profit, roi, margin, is_error };
  }).filter(p => p.profit >= MIN_PROFIT);
}

async function fetchPage(page) {
  const url = `https://www.futbin.com/search?year=27&type=player&page=${page}&player_rating=${RATING_MIN}-${RATING_MAX}&${PLATFORM}_price=200-${PRICE_MAX}&sort=${PLATFORM}_price&order=asc`;

  try {
    const r = await get(url);
    console.log(`Page ${page}: status=${r.status}, len=${r.body.length}`);
    if (r.body.trim().startsWith('[') || r.body.trim().startsWith('{')) {
      const data = JSON.parse(r.body);
      const players = parseJSON(data);
      if (players.length) { console.log(`  → ${players.length} joueurs (JSON)`); return players; }
    }
  } catch(e) { console.log(`  search err: ${e.message}`); }

  // Fallback HTML
  try {
    const url2 = `https://www.futbin.com/27/players?page=${page}&player_rating=${RATING_MIN}-${RATING_MAX}&${PLATFORM}_price=200-${PRICE_MAX}&sort=${PLATFORM}_price&order=asc`;
    const r = await get(url2);
    const players = parseHTML(r.body);
    if (players.length) { console.log(`  → ${players.length} joueurs (HTML)`); return players; }

    // Log début de réponse pour debug
    console.log(`  body[0:200]: ${r.body.substring(0, 200).replace(/\n/g,' ')}`);
  } catch(e) { console.log(`  html err: ${e.message}`); }

  return [];
}

async function main() {
  console.log(`Scan FC27 — ${new Date().toISOString()}`);
  const allPlayers = [];

  for (let pg = 1; pg <= PAGES; pg++) {
    const players = await fetchPage(pg);
    allPlayers.push(...players);
    if (pg < PAGES) await sleep(2000 + Math.random() * 1000);
  }

  console.log(`Total joueurs: ${allPlayers.length}`);
  const deals = calcDeals(allPlayers);
  console.log(`Deals trouvés: ${deals.length}`);

  const output = {
    updated_at: new Date().toISOString(),
    platform: PLATFORM,
    total_scanned: allPlayers.length,
    deals: deals.sort((a, b) => b.profit - a.profit),
  };

  fs.writeFileSync('deals.json', JSON.stringify(output, null, 2));
  console.log('deals.json écrit.');
}

main().catch(e => { console.error(e); process.exit(1); });
