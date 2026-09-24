import type {
  DraftPick,
  LeagueRoster,
  LeagueUser,
  NflState,
  SleeperDraft,
  SleeperLeague,
  SleeperUser,
  StatRecord,
  Transaction,
} from "../types";

const BASE = "https://api.sleeper.app/v1";
// api.sleeper.com (no /v1, different host) is the live projections/actuals
// feed used by Sleeper's own app - sourced from RotoWire, updated several
// times a day. Distinct from the versioned api.sleeper.app/v1 host above.
const LIVE_BASE = "https://api.sleeper.com";

async function getJson<T>(path: string, base: string = BASE): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`Sleeper API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// The fantasy-relevant subset of Sleeper's position taxonomy - filtering to
// these keeps live projection/stat payloads to ~2MB instead of ~6MB for
// every rostered IDP/OL player league-wide.
const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

export function getDraft(draftId: string): Promise<SleeperDraft> {
  return getJson(`/draft/${draftId}`);
}

export function getDraftPicks(draftId: string): Promise<DraftPick[]> {
  return getJson(`/draft/${draftId}/picks`);
}

export function getLeagueUsers(leagueId: string): Promise<LeagueUser[]> {
  return getJson(`/league/${leagueId}/users`);
}

export function getLeagueRosters(leagueId: string): Promise<LeagueRoster[]> {
  return getJson(`/league/${leagueId}/rosters`);
}

export function getUserByUsername(username: string): Promise<SleeperUser> {
  return getJson(`/user/${username}`);
}

export function getUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  return getJson(`/user/${userId}/leagues/nfl/${season}`);
}

export function getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return getJson(`/league/${leagueId}/drafts`);
}

export function getLeague(leagueId: string): Promise<SleeperLeague> {
  return getJson(`/league/${leagueId}`);
}

export function getLeagueTransactions(leagueId: string, week: number): Promise<Transaction[]> {
  return getJson(`/league/${leagueId}/transactions/${week}`);
}

export function getNflState(): Promise<NflState> {
  return getJson(`/state/nfl`);
}

export function getTrendingPlayers(
  type: "add" | "drop",
  lookbackHours = 24,
  limit = 100,
): Promise<{ player_id: string; count: number }[]> {
  return getJson(`/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`);
}

function positionQuery(): string {
  return FANTASY_POSITIONS.map((p) => `position[]=${p}`).join("&");
}

/** Live weekly projections (RotoWire-sourced, updated several times a day) -
 * not the versioned v1 endpoint, which only carries a bare adp placeholder
 * in-season. Each record's `stats` uses the same category keys a league's
 * scoring_settings weights, so lib/scoringEngine.ts can score it directly. */
export function getWeeklyProjections(season: string, week: number): Promise<StatRecord[]> {
  return getJson(`/projections/nfl/${season}/${week}?season_type=regular&${positionQuery()}`, LIVE_BASE);
}

/** Live weekly actuals, same shape as getWeeklyProjections (embedded player/
 * team/opponent) - unlike /v1/stats, which returns a bare player_id-keyed
 * dict with no opponent, so it can't drive matchup-multiplier math. */
export function getWeeklyStats(season: string, week: number): Promise<StatRecord[]> {
  return getJson(`/stats/nfl/${season}/${week}?season_type=regular&${positionQuery()}`, LIVE_BASE);
}
