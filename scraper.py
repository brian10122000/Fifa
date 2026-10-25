#!/usr/bin/env python3
# scraper.py — FC27 deal detector
# Utilise curl_cffi pour imiter le TLS fingerprint de Chrome → bypass Cloudflare

import json, time, random, sys
from datetime import datetime, timezone

try:
    from curl_cffi import requests as cf_requests
except ImportError:
    print("Installing curl_cffi...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "curl-cffi", "-q"], check=True)
    from curl_cffi import requests as cf_requests

# ── Config ───────────────────────────────────────────────────────────────────
PLATFORM    = "ps"
PAGES       = 5
RATING_MIN  = 82
RATING_MAX  = 99
PRICE_MAX   = 300000
ERROR_RATIO = 0.82
MIN_PROFIT  = 300

HEADERS = {
    "Accept":          "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
    "X-Requested-With":"XMLHttpRequest",
    "Referer":         "https://www.futbin.com/27/players",
    "Origin":          "https://www.futbin.com",
}

SESSION = cf_requests.Session(impersonate="chrome124")

# ── Fetch ────────────────────────────────────────────────────────────────────
def get(url, retries=3):
    for attempt in range(retries):
        try:
            r = SESSION.get(url, headers=HEADERS, timeout=20)
            print(f"  GET {url[:80]}... → {r.status_code} ({len(r.text)} chars)")
            return r
        except Exception as e:
            print(f"  err attempt {attempt+1}: {e}")
            if attempt < retries - 1:
                time.sleep(3)
    return None

# ── Parse ────────────────────────────────────────────────────────────────────
def parse_json(data):
    arr = data if isinstance(data, list) else data.get("players", data.get("data", []))
    players = []
    for p in arr:
        pid   = str(p.get("id") or p.get("player_id") or "")
        name  = p.get("player_name") or p.get("name") or ""
        pos   = p.get("position") or p.get("pos") or ""
        rat   = int(p.get("rating") or p.get("player_rating") or 0)
        buy   = int(p.get(f"{PLATFORM}_price") or p.get("price") or 0)
        avg   = int(p.get(f"{PLATFORM}_avg_price") or p.get("avg_price") or buy)
        lc    = int(p.get(f"{PLATFORM}_LCPrice") or p.get("lowest_price") or buy)
        ver   = p.get("version") or p.get("card_type") or "gold"
        if buy > 0 and name:
            players.append(dict(id=pid, name=name, pos=pos, rating=rat,
                                buy_price=buy, avg_price=avg, low_price=lc,
                                version=ver,
                                photo=f"https://cdn.futbin.com/content/fifa27/img/players/{pid}.png"))
    return players

import re as _re

def parse_html(html):
    players = []
    pat = _re.compile(
        r'data-player-id="(\d+)"[^>]*data-player-name="([^"]+)"[^>]*'
        r'data-rating="(\d+)"[^>]*data-position="([^"]+)"[^>]*'
        r'data-(?:ps|pc)-price="(\d+)"[^>]*data-avg-price="(\d+)"'
    )
    for m in pat.finditer(html):
        pid, name, rat, pos, buy, avg = m.groups()
        if int(buy) < 100: continue
        players.append(dict(id=pid, name=name, pos=pos, rating=int(rat),
                            buy_price=int(buy), avg_price=int(avg), low_price=int(buy),
                            version="gold",
                            photo=f"https://cdn.futbin.com/content/fifa27/img/players/{pid}.png"))
    return players

# ── Deals ────────────────────────────────────────────────────────────────────
def calc_deals(players):
    out = []
    for p in players:
        avg    = p["avg_price"] or p["buy_price"]
        low    = p["low_price"]  or avg
        buy    = p["buy_price"]
        net    = int(avg * 0.95)
        profit = net - buy
        roi    = round(profit / buy * 100) if buy else 0
        margin = round(profit / avg * 100) if avg else 0
        is_err = (low > 0 and buy < low * ERROR_RATIO)
        if profit >= MIN_PROFIT:
            out.append({**p, "profit": profit, "roi": roi, "margin": margin, "is_error": is_err})
    return sorted(out, key=lambda x: -x["profit"])

# ── Scrape ───────────────────────────────────────────────────────────────────
def fetch_page(page):
    # Essai 1 : endpoint JSON search
    url1 = (f"https://www.futbin.com/search?year=27&type=player&page={page}"
            f"&player_rating={RATING_MIN}-{RATING_MAX}"
            f"&{PLATFORM}_price=200-{PRICE_MAX}"
            f"&sort={PLATFORM}_price&order=asc")
    r = get(url1)
    if r and r.status_code == 200:
        try:
            data = r.json()
            players = parse_json(data)
            if players:
                print(f"  → {len(players)} joueurs (JSON search)")
                return players
        except Exception as e:
            print(f"  json parse err: {e}")

    # Essai 2 : page HTML players
    url2 = (f"https://www.futbin.com/27/players?page={page}"
            f"&player_rating={RATING_MIN}-{RATING_MAX}"
            f"&{PLATFORM}_price=200-{PRICE_MAX}"
            f"&sort={PLATFORM}_price&order=asc")
    r2 = get(url2)
    if r2 and r2.status_code == 200:
        # tente JSON d'abord
        try:
            data = r2.json()
            players = parse_json(data)
            if players:
                print(f"  → {len(players)} joueurs (JSON fallback)")
                return players
        except: pass
        # puis HTML
        players = parse_html(r2.text)
        if players:
            print(f"  → {len(players)} joueurs (HTML)")
            return players
        print(f"  body[0:300]: {r2.text[:300].replace(chr(10),' ')}")

    return []

def main():
    print(f"Scan FC27 — {datetime.now(timezone.utc).isoformat()}")
    all_players = []

    for pg in range(1, PAGES + 1):
        print(f"Page {pg}:")
        players = fetch_page(pg)
        all_players.extend(players)
        if pg < PAGES:
            time.sleep(2 + random.random() * 1.5)

    print(f"Total joueurs : {len(all_players)}")
    deals = calc_deals(all_players)
    print(f"Deals trouvés : {len(deals)}")

    output = {
        "updated_at":    datetime.now(timezone.utc).isoformat(),
        "platform":      PLATFORM,
        "total_scanned": len(all_players),
        "deals":         deals,
    }
    with open("deals.json", "w") as f:
        json.dump(output, f, indent=2)
    print("deals.json écrit.")

if __name__ == "__main__":
    main()
