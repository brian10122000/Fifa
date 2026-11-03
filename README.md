# FC 27 PC – Flip Desk

Dashboard Achat/Revente (marché PC) : Node.js/Express + interface HTML/Tailwind (mode sombre).
Profit calculé avec la taxe EA : `Benefice_Net = (Prix_Vente × 0.95) − Prix_Achat`.

## Lancer en local
Prérequis : Node.js 18+.

```bash
cd fc27-flip-dashboard
npm install
npm start
```
Ouvre http://localhost:3000 (changer le port : `PORT=4000 npm start`).

## Fonctionnalités
- **Flips immédiats** : prix actuel, achat max conseillé (ROI ≥ 5 % après taxe), revente estimée, marge nette, ROI, liquidité.
- **Fodder & investissements** : notes 84 à 89 + TOTW, écart au prix plancher, alerte « Sous le plancher » (≤ plancher +3 %).
- **Budget** : ne montre que ce que tu peux acheter. **Actualiser** : force un nouveau relevé (auto toutes les 30 s).

## Source des données (important)
Futbin et FutNext sont protégés contre le scraping (anti-bot) et leurs conditions d'utilisation l'interdisent
généralement ; leur HTML change aussi souvent. Je n'ai donc pas inclus de scraper fragile :
- **Par défaut** : simulateur temps réel (marche aléatoire + retour à la moyenne). Les prix et joueurs sont indicatifs, pas réels.
- **Source live** : définis `LIVE_API_URL` vers une API/proxy JSON que tu possèdes ou as le droit d'utiliser :
  ```bash
  LIVE_API_URL="https://ton-api/prix" npm start
  ```
  Format attendu :
  ```json
  { "players": [{ "id": 1, "price": 423000 }], "fodder": [{ "key": "84", "price": 1650 }] }
  ```
  Si l'appel échoue, l'app retombe automatiquement sur le simulateur.

## Arborescence
```
server/index.js    API Express (/api/market?budget=&refresh=1) + fichiers statiques
server/market.js   données, simulateur, source live, calcul des opportunités
server/profit.js   taxe 5 %, net, ROI, achat max, paliers de prix EA
public/            interface (index.html + app.js)
```
Personnaliser les joueurs/prix de base : tableaux `PLAYERS` et `FODDER` dans `server/market.js`.
