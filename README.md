# Scouting Sage

A live Sleeper draft assistant. Phase 1 of a broader fantasy-football
companion app (start/sit, waivers, trades come later — see the plan at
`~/.claude/plans/i-want-to-create-scalable-newell.md` for the full roadmap).

## What it does

- Paste a Sleeper `draft_id` (or draft room URL) and your Sleeper username.
- Polls Sleeper's live draft every few seconds and shows:
  - **Best Available**, ranked by FantasyPros consensus rank, with position
    filter + search.
  - **My Roster**, built from picks attributed to your username.
  - **Positional Need**, derived from the draft's own roster settings
    (works for any league's slot configuration).
- Runs entirely client-side (Sleeper's API allows cross-origin browser
  requests) — no backend server required.

## One-time setup: build the player rankings file

Sleeper doesn't provide rankings/ADP itself, so this joins Sleeper's player
IDs to FantasyPros' consensus rankings via a free public ID crosswalk
(`dynastyprocess/data`). Run this the **morning of your draft** for the
freshest rankings:

```bash
cd data-prep
python3 -m venv .venv        # first time only
source .venv/bin/activate
pip install -r requirements.txt   # first time only

python3 fetch_sleeper_players.py
python3 fetch_fantasypros_ecr.py
python3 fetch_id_crosswalk.py
python3 build_player_pool.py
```

`build_player_pool.py` prints join-coverage stats — expect ~100% match on
the top 300 ranked players. It writes `web/public/player_pool.json`, which
the app loads statically (no live scraping during the draft itself).

## Running the app

```bash
cd web
npm install     # first time only
npm run dev
```

Open the printed `http://localhost:5173` URL. **Run it locally** for the
actual draft — no deploy needed or recommended for draft night.

## Rehearse before the real draft

Start a [Sleeper Mock Draft](https://sleeper.com) (against bots, available
any time) and point the app at its `draft_id` — it uses the exact same API
shape as a real draft, so this is the best way to confirm everything works
before it matters.

## Project layout

```
data-prep/     Python scripts that build web/public/player_pool.json
web/           React + Vite (TypeScript) single-page app
```

Key files: `data-prep/build_player_pool.py` (the Sleeper/FantasyPros join),
`web/src/hooks/useDraftPoller.ts` (the live polling loop), `web/src/lib/positionalNeed.ts`
(the settings-driven need heuristic).
