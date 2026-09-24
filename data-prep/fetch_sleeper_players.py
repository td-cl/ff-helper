"""Fetch Sleeper's full NFL player dictionary and cache it locally.

Sleeper asks integrators not to hit this endpoint more than once a day:
https://docs.sleeper.com/#fetch-all-players
"""
import json
from pathlib import Path

import requests

CACHE_DIR = Path(__file__).parent / "cache"
OUT_PATH = CACHE_DIR / "sleeper_players.json"
URL = "https://api.sleeper.app/v1/players/nfl"

FANTASY_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DEF"}


def main() -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    print(f"Fetching {URL} ...")
    resp = requests.get(URL, timeout=30)
    resp.raise_for_status()
    players = resp.json()

    relevant = {
        pid: p
        for pid, p in players.items()
        if p and p.get("position") in FANTASY_POSITIONS
    }

    OUT_PATH.write_text(json.dumps(relevant))
    print(f"Fetched {len(players)} total players, kept {len(relevant)} fantasy-relevant.")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
