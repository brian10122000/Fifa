const { netProfit, roi, maxBuyFor, roundNearest } = require("./profit");

// ---------- Données de base (prix PC indicatifs, à remplacer par une source réelle) ----------
const PLAYERS = [
  { id: 1, name: "Mbappé", rating: 91, pos: "ATT", style: "Chasseur", base: 420000, liq: 0.95 },
  { id: 2, name: "Haaland", rating: 91, pos: "BU", style: "Chasseur", base: 380000, liq: 0.9 },
  { id: 3, name: "Vinícius Jr", rating: 90, pos: "AG", style: "Ombre", base: 310000, liq: 0.85 },
  { id: 4, name: "Bellingham", rating: 90, pos: "MOC", style: "Ombre", base: 260000, liq: 0.8 },
  { id: 5, name: "Yamal", rating: 89, pos: "AD", style: "Chasseur", base: 150000, liq: 0.85 },
  { id: 6, name: "Rodri", rating: 90, pos: "MDC", style: "Ombre", base: 95000, liq: 0.7 },
  { id: 7, name: "Saka", rating: 88, pos: "AD", style: "Chasseur", base: 72000, liq: 0.75 },
  { id: 8, name: "Rüdiger", rating: 87, pos: "DC", style: "Ombre", base: 38000, liq: 0.8 },
  { id: 9, name: "Kimmich", rating: 88, pos: "MDC", style: "Ombre", base: 41000, liq: 0.7 },
  { id: 10, name: "Dembélé", rating: 88, pos: "AD", style: "Chasseur", base: 56000, liq: 0.8 },
  { id: 11, name: "Van Dijk", rating: 89, pos: "DC", style: "Ombre", base: 64000, liq: 0.75 },
  { id: 12, name: "Lautaro", rating: 88, pos: "BU", style: "Chasseur", base: 47000, liq: 0.85 },
  { id: 13, name: "Pedri", rating: 87, pos: "MC", style: "Ombre", base: 29000, liq: 0.65 },
  { id: 14, name: "Hakimi", rating: 87, pos: "DD", style: "Ombre", base: 24000, liq: 0.8 },
  { id: 15, name: "Barella", rating: 87, pos: "MC", style: "Ombre", base: 19000, liq: 0.6 },
  { id: 16, name: "Musiala", rating: 89, pos: "MOC", style: "Chasseur", base: 98000, liq: 0.7 },
];
const FODDER = [
  { key: "84", label: "Note 84", floor: 1400, base: 1800 },
  { key: "85", label: "Note 85", floor: 2800, base: 3600 },
  { key: "86", label: "Note 86", floor: 5500, base: 7200 },
  { key: "87", label: "Note 87", floor: 10500, base: 13500 },
  { key: "88", label: "Note 88", floor: 21000, base: 27000 },
  { key: "89", label: "Note 89", floor: 42000, base: 52000 },
  { key: "TOTW", label: "TOTW / In-Form", floor: 11000, base: 15000 },
];

// ---------- Simulateur (marche aléatoire avec retour à la moyenne) ----------
const state = { prices: {}, fodder: {}, tickCount: 0 };
for (const p of PLAYERS) state.prices[p.id] = p.base;
for (const f of FODDER) state.fodder[f.key] = { price: f.base, history: [f.base] };

const rnd = (a, b) => a + Math.random() * (b - a);

function tick() {
  state.tickCount++;
  for (const p of PLAYERS) {
    const cur = state.prices[p.id];
    const drift = (p.base - cur) / p.base * 0.15; // retour à la moyenne
    state.prices[p.id] = Math.max(p.base * 0.7, cur * (1 + drift + rnd(-0.03, 0.03)));
  }
  for (const f of FODDER) {
    const s = state.fodder[f.key];
    const shock = Math.random() < 0.12 ? rnd(-0.22, -0.1) : 0; // petite chance de "crash" (nouveau SBC/pack)
    s.price = Math.max(f.floor * 0.9, s.price * (1 + (f.base - s.price) / f.base * 0.2 + rnd(-0.04, 0.04) + shock));
    s.history = [...s.history, Math.round(s.price)].slice(-12);
  }
}

// ---------- Source live optionnelle ----------
// Futbin/FutNext sont protégés (anti-bot) et leur HTML change souvent.
// Si tu as une API/proxy qui renvoie du JSON, mets LIVE_API_URL dans .env/variables d'env.
// Format attendu : { "players": [{ "id":1, "price":123000 }], "fodder": [{ "key":"84", "price":1600 }] }
async function fetchLive() {
  const url = process.env.LIVE_API_URL;
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    console.warn("[live] indisponible, fallback simulateur :", e.message);
    return null;
  }
}

async function refresh() {
  const live = await fetchLive();
  if (live && Array.isArray(live.players)) {
    for (const x of live.players) if (state.prices[x.id] != null) state.prices[x.id] = x.price;
    for (const x of live.fodder || []) if (state.fodder[x.key]) {
      state.fodder[x.key].price = x.price;
      state.fodder[x.key].history = [...state.fodder[x.key].history, x.price].slice(-12);
    }
    return "live";
  }
  tick();
  return "simulé";
}

// ---------- Calcul des opportunités ----------
function liqLabel(l) { return l >= 0.85 ? "Très rapide" : l >= 0.7 ? "Rapide" : l >= 0.6 ? "Moyenne" : "Lente"; }

function getDeals(budget) {
  const deals = PLAYERS.map((p) => {
    const resale = roundNearest(state.prices[p.id]);               // prix de revente estimé
    const dip = p.liq > 0.8 ? rnd(0.03, 0.1) : rnd(0.02, 0.08);    // décote constatée sur la meilleure annonce
    const buy = roundNearest(resale * (1 - dip));                  // prix d'achat observé
    return {
      id: p.id, name: p.name, rating: p.rating, pos: p.pos, style: p.style,
      buyNow: buy, maxBuy: maxBuyFor(resale, 5), resale,
      net: netProfit(resale, buy), roi: +roi(resale, buy).toFixed(1),
      liquidity: liqLabel(p.liq), liquidityScore: Math.round(p.liq * 100),
    };
  }).filter((d) => d.net > 0 && (!budget || d.buyNow <= budget));
  return deals.sort((a, b) => b.net - a.net);
}

function getFodder(budget) {
  return FODDER.map((f) => {
    const s = state.fodder[f.key];
    const price = roundNearest(s.price);
    const vsFloor = +(((price - f.floor) / f.floor) * 100).toFixed(1);
    const alert = price <= f.floor * 1.03;
    return {
      key: f.key, label: f.label, price, floor: f.floor, vsFloor, alert,
      history: s.history, potentialNet: netProfit(f.base, price),
      potentialRoi: +roi(f.base, price).toFixed(1),
    };
  }).filter((f) => !budget || f.price <= budget);
}

module.exports = { refresh, getDeals, getFodder };
