// Taxe EA : 5% prélevés sur le prix de vente.
const EA_TAX = 0.05;

// Paliers de prix EA (pas d'enchère)
function step(p) {
  if (p < 1000) return 50;
  if (p < 10000) return 100;
  if (p < 50000) return 250;
  if (p < 100000) return 500;
  return 1000;
}
const roundDown = (p) => Math.floor(p / step(p)) * step(p);
const roundNearest = (p) => Math.round(p / step(p)) * step(p);

// Benefice_Net = (Prix_Vente * 0.95) - Prix_Achat
function netProfit(sell, buy) {
  return Math.round(sell * (1 - EA_TAX) - buy);
}
function roi(sell, buy) {
  return buy > 0 ? (netProfit(sell, buy) / buy) * 100 : 0;
}
// Prix d'achat max pour garantir un ROI minimum après taxe
function maxBuyFor(sell, minRoiPct = 5) {
  return roundDown((sell * (1 - EA_TAX)) / (1 + minRoiPct / 100));
}

module.exports = { EA_TAX, netProfit, roi, maxBuyFor, roundDown, roundNearest };
