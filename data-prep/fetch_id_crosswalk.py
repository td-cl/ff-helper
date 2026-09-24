"""Download the dynastyprocess/data player ID crosswalk.

This maps Sleeper IDs directly to FantasyPros IDs (and several others),
avoiding any fuzzy name-matching between Sleeper and FantasyPros data.
"""
from pathlib import Path

import requests

CACHE_DIR = Path(__file__).parent / "cache"
OUT_PATH = CACHE_DIR / "db_playerids.csv"
URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv"


def main() -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    print(f"Fetching {URL} ...")
    resp = requests.get(URL, timeout=30)
    resp.raise_for_status()
    OUT_PATH.write_bytes(resp.content)
    print(f"Wrote {OUT_PATH} ({len(resp.content)} bytes)")


if __name__ == "__main__":
    main()
