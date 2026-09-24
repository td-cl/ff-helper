"""Join Sleeper players + FantasyPros ECR (+ an optional second custom
rankings CSV) via the dynastyprocess ID crosswalk.

Produces web/public/player_pool.json: one ranked list of fantasy-relevant
players, each carrying its Sleeper ID (what the draft-picks feed uses) plus
a blended rank from whichever ranking source(s) cover that player. Players
no source ranks (or that the crosswalk can't map) fall back to Sleeper's
own `search_rank` so nothing is ever silently dropped.

To blend in a second ranking source, drop a CSV at CUSTOM_CSV_PATH with at
least Player Name/Team/Position columns and a rank column (see
CUSTOM_CSV_RANK_COLUMN below) - this is optional, the script runs fine
without it. There's no player-ID column in a plain rankings export, so it's
joined by normalized name+position instead of the ID crosswalk.

Run order: fetch_sleeper_players.py, fetch_fantasypros_ecr.py,
fetch_id_crosswalk.py, then this script.
"""
import json
import re
from pathlib import Path

import pandas as pd

CACHE_DIR = Path(__file__).parent / "cache"
OUT_PATH = Path(__file__).parent.parent / "web" / "public" / "player_pool.json"

CUSTOM_CSV_PATH = Path(__file__).parent / "FantasyPros-expert-rankings.csv"
CUSTOM_CSV_SKIPROWS = 4  # FantasyPros export prefixes the header with title/blank lines
CUSTOM_CSV_RANK_COLUMN = "Rank"

# Equal by default - bump one up if you trust a source more than the other.
SOURCE_WEIGHTS = {"ecr": 1.0, "custom": 2.0}

UNMATCHED_RANK_FALLBACK = 100_000  # sort key for players with no search_rank at all

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def normalize_name(name: str) -> str:
    """Lowercases and strips punctuation/generational suffixes so the same
    player matches across sources that format names slightly differently
    (e.g. "James Cook III" vs. "James Cook")."""
    cleaned = name.lower().replace(".", "").replace("'", "").replace("-", " ")
    tokens = cleaned.split()
    if tokens and tokens[-1] in SUFFIXES:
        tokens = tokens[:-1]
    return " ".join(tokens)


def clean_id(value) -> str | None:
    """dynastyprocess IDs come through pandas as floats (e.g. 4046.0) when
    the column has any NaNs; normalize to a plain string or None."""
    if pd.isna(value):
        return None
    s = str(value).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s or None


def resolve_name(pid: str, record: dict) -> str:
    full = record.get("full_name")
    if full:
        return full
    first, last = record.get("first_name"), record.get("last_name")
    if first or last:
        return " ".join(p for p in (first, last) if p)
    return pid  # e.g. team defenses as a last resort


def load_custom_rankings() -> dict[tuple[str, str], dict]:
    """Returns {(normalized_name, position): {"rank_custom": int, "team": str}}.
    Missing file is not an error - the blend just falls back to ECR alone."""
    if not CUSTOM_CSV_PATH.exists():
        print(f"No custom rankings CSV found at {CUSTOM_CSV_PATH} - skipping that source.")
        return {}

    # index_col=False: the export has a trailing comma (an extra blank field per
    # row), which otherwise makes pandas treat the first column as a row index
    # and silently shift every other column left by one.
    df = pd.read_csv(CUSTOM_CSV_PATH, skiprows=CUSTOM_CSV_SKIPROWS, index_col=False)
    df.columns = [c.strip() for c in df.columns]
    by_name_pos: dict[tuple[str, str], dict] = {}
    for _, row in df.iterrows():
        name = row.get("Player Name")
        position = row.get("Position")
        rank = row.get(CUSTOM_CSV_RANK_COLUMN)
        if pd.isna(name) or pd.isna(position) or pd.isna(rank):
            continue
        key = (normalize_name(str(name)), str(position).strip().upper())
        by_name_pos[key] = {"rank_custom": int(rank), "team": str(row.get("Team", "")).strip()}
    print(f"Loaded {len(by_name_pos)} ranked players from {CUSTOM_CSV_PATH.name}.")
    return by_name_pos


def match_custom_rank(
    name: str, position: str, team: str | None, custom_by_name_pos: dict[tuple[str, str], dict]
) -> int | None:
    if not custom_by_name_pos:
        return None
    key = (normalize_name(name), (position or "").upper())
    hit = custom_by_name_pos.get(key)
    return hit["rank_custom"] if hit else None


def blend_rank(rank_ecr: float | None, rank_custom: float | None) -> float | None:
    parts = []
    if rank_ecr is not None:
        parts.append((rank_ecr, SOURCE_WEIGHTS["ecr"]))
    if rank_custom is not None:
        parts.append((rank_custom, SOURCE_WEIGHTS["custom"]))
    if not parts:
        return None
    total_weight = sum(w for _, w in parts)
    return sum(r * w for r, w in parts) / total_weight


def main() -> None:
    sleeper_players = json.loads((CACHE_DIR / "sleeper_players.json").read_text())
    ecr_data = json.loads((CACHE_DIR / "fantasypros_ecr.json").read_text())
    crosswalk_df = pd.read_csv(CACHE_DIR / "db_playerids.csv", low_memory=False)
    custom_by_name_pos = load_custom_rankings()

    # sleeper_id -> fantasypros_id, direct key join, no fuzzy name matching
    sleeper_to_fp: dict[str, str] = {}
    for _, row in crosswalk_df.iterrows():
        sid = clean_id(row.get("sleeper_id"))
        fpid = clean_id(row.get("fantasypros_id"))
        if sid and fpid:
            sleeper_to_fp[sid] = fpid

    # fantasypros player_id -> ECR record
    fp_by_id = {str(p["player_id"]): p for p in ecr_data.get("players", [])}

    pool = []
    ecr_matched_count = 0
    custom_matched_count = 0
    for sleeper_id, record in sleeper_players.items():
        name = resolve_name(sleeper_id, record)
        position = record.get("position")
        team = record.get("team")

        fp_id = sleeper_to_fp.get(sleeper_id)
        ecr = fp_by_id.get(fp_id) if fp_id else None
        rank_ecr = ecr["rank_ecr"] if ecr else None

        rank_custom = match_custom_rank(name, position, team, custom_by_name_pos)

        if ecr is not None:
            ecr_matched_count += 1
        if rank_custom is not None:
            custom_matched_count += 1

        search_rank = record.get("search_rank")
        entry = {
            "sleeper_id": sleeper_id,
            "name": name,
            "position": position,
            "team": team,
            "matched": ecr is not None or rank_custom is not None,
            "rank_ecr": rank_ecr,
            "rank_custom": rank_custom,
            "blended_rank": blend_rank(rank_ecr, rank_custom),
            "tier": ecr.get("tier") if ecr else None,
            "pos_rank": ecr.get("pos_rank") if ecr else None,
            "search_rank": search_rank,
        }
        pool.append(entry)

    def sort_key(e: dict):
        if e["blended_rank"] is not None:
            return (0, e["blended_rank"])
        sr = e["search_rank"]
        return (1, sr if sr is not None else UNMATCHED_RANK_FALLBACK)

    pool.sort(key=sort_key)
    for i, entry in enumerate(pool, start=1):
        entry["rank"] = i

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(pool))

    total = len(pool)
    top_300 = pool[:300]
    top_300_matched = sum(1 for e in top_300 if e["matched"])
    print(f"Total fantasy-relevant players: {total}")
    print(f"Matched to FantasyPros ECR: {ecr_matched_count} ({ecr_matched_count / total:.1%})")
    if custom_by_name_pos:
        print(
            f"Matched to custom CSV: {custom_matched_count} "
            f"({custom_matched_count / len(custom_by_name_pos):.1%} of that file's rows found in Sleeper)"
        )
    print(
        f"Top 300 by final rank matched to at least one ranking source: {top_300_matched}/300 "
        f"({top_300_matched / 300:.1%})"
    )
    if top_300_matched / 300 < 0.95:
        print(
            "WARNING: top-300 match rate is below the 95% target from the plan. "
            "Check fetch_fantasypros_ecr.py output and the crosswalk file for issues."
        )
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
