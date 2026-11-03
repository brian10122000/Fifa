const path = require("path");
const express = require("express");
const cors = require("cors");
const { refresh, getDeals, getFodder } = require("./market");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "..", "public")));

let source = "simulé";
let updatedAt = Date.now();

// Un cycle de mise à jour au démarrage + toutes les 60 s côté serveur
const cycle = async () => { source = await refresh(); updatedAt = Date.now(); };
cycle();
setInterval(cycle, 60000);

const parseBudget = (q) => { const n = Number(q); return Number.isFinite(n) && n > 0 ? n : 0; };

app.get("/api/market", async (req, res) => {
  if (req.query.refresh === "1") await cycle();
  const budget = parseBudget(req.query.budget);
  res.json({ platform: "PC", source, updatedAt, deals: getDeals(budget), fodder: getFodder(budget) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FC27 Flip Dashboard : http://localhost:${PORT}`));
