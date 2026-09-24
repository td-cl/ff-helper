"""Scrape FantasyPros' half-PPR overall cheatsheet rankings.

The rankings page server-renders a `var ecrData = {...};` JSON blob inline.
This page is not disallowed by fantasypros.com/robots.txt (only /ajax/, /api/,
/json/, /xml/, and /nfl/ranker/ are). Run this at most a few times a day
(honoring the site's Crawl-delay: 5) -- it's not a live-draft dependency,
just a once-a-morning refresh.
"""
import json
from pathlib import Path

import requests

CACHE_DIR = Path(__file__).parent / "cache"
OUT_PATH = CACHE_DIR / "fantasypros_ecr.json"
URL = "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (personal fantasy-football draft tool)"}


def extract_ecr_data(html: str) -> dict:
    marker = "var ecrData ="
    idx = html.find(marker)
    if idx == -1:
        raise RuntimeError(
            "Could not find 'var ecrData =' in FantasyPros page - page structure "
            "may have changed. Falling back to Sleeper search_rank is still safe."
        )
    start = idx + len(marker)
    # skip whitespace up to the opening brace
    start = start + len(html[start:]) - len(html[start:].lstrip())
    decoder = json.JSONDecoder()
    data, _ = decoder.raw_decode(html[start:])
    return data


def main() -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    print(f"Fetching {URL} ...")
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    data = extract_ecr_data(resp.text)
    players = data.get("players", [])
    if len(players) < 200:
        raise RuntimeError(
            f"Only found {len(players)} ranked players -- expected several hundred. "
            "Page structure may have changed; not writing a bad cache file."
        )

    OUT_PATH.write_text(json.dumps(data))
    print(f"Fetched {len(players)} ranked players (of {data.get('count')} claimed).")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
