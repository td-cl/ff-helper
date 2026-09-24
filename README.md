# Scouting Sage

A fantasy football companion for [Sleeper](https://sleeper.com) leagues. It started as a live draft assistant and now also covers the regular season: a multi-league dashboard, waiver targets with FAAB bid suggestions, and trade ideas.

Everything runs in the browser. There is no backend or database; the app calls public APIs directly.

## Features

### In-season mode
- **Season dashboard** – every in-season league at a glance: record, FAAB remaining, top waiver target.
- **Roster** – cards laid out in your league's exact slot order (QB, RB, RB, WR, WR, TE, FLEX, ..., Bench, IR), each showing this week's projection and opponent, a week rank and a rest-of-season rank at the player's position, and bye/injury flags.
- **Waiver targets** – trending adds that are actually available in your league, ranked by value over replacement rather than raw points (raw points overrate QB and K). Each row carries a suggested FAAB bid and a confidence label.
- **Trending** – top 20 available players per position by Sleeper add count.
- **Trades** – one-for-one buy-low / sell-high suggestions against each leaguemate's roster, using FantasyCalc trade values and 30-day momentum.
- **League switcher** – change leagues from the header without going back to the dashboard.

### Draft mode
Paste a Sleeper draft ID or pick a league in pre-draft/drafting status. The app polls the live draft and shows best available (by consensus rank, editable), positional need, and positional run/value signals.

## How the numbers work

The scoring logic is plain arithmetic that can be read and checked, not a black box.

- **League-accurate scoring** – Sleeper's live projections and weekly actuals return raw stat categories (`rec_yd`, `pass_td`, ...). Those are scored with each league's own `scoring_settings`, so a QB in a 6-point-passing-TD league is valued differently than in a standard one.
- **Matchup multiplier** – the opponent's points allowed to that position, relative to the league average, clamped to 0.75–1.35 so a small early-season sample can't swing a value wildly.
- **Value over replacement** – each position's replacement level comes from that league's real starter demand (dedicated slots plus a share of FLEX/SUPER_FLEX). Waiver targets are ranked by distance above it.
- **Bid suggestions** – built from the league's own waiver history, including failed bids. Confidence drops as more managers historically competed at that price tier. With too little history it falls back to a flat share of budget and says so.

Known simplifications: bid history values players at today's value rather than at the time of the bid; FLEX demand is split evenly across eligible positions; the ROS rank is FantasyCalc's redraft value rank, a proxy rather than a points projection.

## Tech stack

React 19, TypeScript, Vite. Lint with oxlint. Data prep is a handful of Python scripts (pandas, requests).

## Running it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run lint
```

Enter your Sleeper username on the home screen; it is saved in your browser's localStorage. In-season features need no setup.

### Optional: draft rankings file

Draft mode ranks players from a static `web/public/player_pool.json`, built by joining Sleeper player IDs to FantasyPros consensus rankings through a public ID crosswalk ([dynastyprocess/data](https://github.com/dynastyprocess/data)).

```bash
cd data-prep
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 fetch_sleeper_players.py
python3 fetch_fantasypros_ecr.py
python3 fetch_id_crosswalk.py
python3 build_player_pool.py
```

To blend in a second ranking source, drop a FantasyPros rankings CSV export at `data-prep/FantasyPros-expert-rankings.csv` (git-ignored). The build works without it.

The FantasyPros fetch reads one public page, at most a few times a day, respecting its crawl delay. It is meant for personal use.

## Data sources

| Source | Used for |
|---|---|
| [Sleeper API](https://docs.sleeper.com) | leagues, rosters, transactions, trending adds, drafts |
| Sleeper live projections/stats (`api.sleeper.com`) | weekly projections and actuals (undocumented endpoints, RotoWire-sourced) |
| [FantasyCalc](https://fantasycalc.com) | trade values, momentum, ROS rank (undocumented public endpoint) |
| FantasyPros | consensus draft rankings (data-prep only) |

Undocumented endpoints can change without notice.

## Project layout

```
web/src/
  api/          Sleeper and FantasyCalc clients
  hooks/        data fetching + TTL caching (live weekly data, transactions, trade values)
  lib/          pure logic: scoringEngine, matchup, replacementValue, bidEngine, tradeFinder, rosterSlots, draft helpers
  components/   dashboard, league view, roster cards, tables, draft-mode UI
data-prep/      Python scripts that build the draft rankings file
```

## Roadmap

Start/sit and lineup alerts, drop candidates, a FAAB budget planner, cross-league exposure, and an offline-trained projection model to compare against the arithmetic one.

Not affiliated with Sleeper, FantasyCalc, or FantasyPros.
