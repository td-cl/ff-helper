export interface PoolPlayer {
  sleeper_id: string;
  name: string;
  position: string;
  team: string | null;
  matched: boolean;
  rank_ecr: number | null;
  rank_custom: number | null;
  blended_rank: number | null;
  tier: number | null;
  pos_rank: string | null;
  search_rank: number | null;
  rank: number;
}

export interface LeagueSettings {
  waiver_budget?: number;
  waiver_type?: number;
  type?: number;
  [key: string]: number | undefined;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: "pre_draft" | "drafting" | "in_season" | "complete";
  avatar: string | null;
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  settings: LeagueSettings;
}

export interface DraftPick {
  pick_no: number;
  round: number;
  roster_id: number | null;
  player_id: string;
  picked_by: string | null;
  draft_slot: number;
  metadata: Record<string, string>;
}

export interface DraftSettings {
  rounds: number;
  teams?: number;
  slots_qb?: number;
  slots_rb?: number;
  slots_wr?: number;
  slots_te?: number;
  slots_flex?: number;
  slots_super_flex?: number;
  slots_bn?: number;
  slots_def?: number;
  slots_k?: number;
  [key: string]: number | undefined;
}

export interface SleeperDraft {
  draft_id: string;
  status: "pre_draft" | "drafting" | "paused" | "complete";
  settings: DraftSettings;
  slot_to_roster_id: Record<string, number> | null;
  draft_order: Record<string, number> | null;
  league_id: string | null;
  season: string;
  type: string;
}

export interface LeagueUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

export interface RosterSettings {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  waiver_budget_used?: number;
  waiver_position?: number;
  [key: string]: number | undefined;
}

export interface LeagueRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  settings: RosterSettings;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
}

export interface NflState {
  week: number;
  season: string;
  season_type: string;
}

/** Common shape returned by both Sleeper's live projections and actuals
 * endpoints (https://api.sleeper.com/{projections,stats}/nfl/{season}/{week}) -
 * an array of per-player-week records with the raw stat category lines
 * (same keys a league's own scoring_settings uses) plus embedded player
 * metadata, team and opponent. Distinct from the older /v1/stats endpoint,
 * which returns a bare player_id-keyed dict with no embedded metadata. */
export interface StatPlayerMeta {
  position: string;
  team: string | null;
  injury_status: string | null;
  first_name: string;
  last_name: string;
  fantasy_positions: string[];
}

export interface StatRecord {
  player_id: string;
  team: string | null;
  opponent: string | null;
  week: number;
  season: string;
  category: "proj" | "stat";
  stats: Record<string, number>;
  player: StatPlayerMeta | null;
}

export interface TransactionSettings {
  waiver_bid?: number;
  seq?: number;
}

export interface Transaction {
  transaction_id: string;
  type: "waiver" | "free_agent" | "trade";
  status: "complete" | "failed";
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  roster_ids: number[];
  settings: TransactionSettings | null;
  created: number;
}

/** FantasyCalc (https://fantasycalc.com) trade values - not an
 * Anthropic/Sleeper API, no official published docs (their /api-docs page
 * is a client-rendered SPA); this endpoint shape was verified directly
 * against https://api.fantasycalc.com/values/current. No auth required. */
export interface FantasyCalcPlayer {
  id: number;
  sleeperId: string | null;
  name: string;
  position: string;
}

export interface FantasyCalcValue {
  player: FantasyCalcPlayer;
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day: number;
  maybeRosterPercent: number | null;
}
