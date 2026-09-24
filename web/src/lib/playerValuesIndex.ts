import type { StatRecord } from "../types";
import { averageAcrossWeeks, computeWeekPtsAllowed, leagueAverageByPosition, matchupMultiplier } from "./matchup";
import { computePlayerValue, type PlayerValue } from "./scoringEngine";

export interface PlayerValueEntry extends PlayerValue {
  name: string;
  position: string;
  team: string | null;
  opponent: string | null;
  injuryStatus: string | null;
  /** 1-based rank among every player at this position by this week's
   * value (the same number shown as "Wk N proj" on roster cards) - null
   * for a player on a bye, who has no real projection to rank. */
  weekRank: number | null;
}

const RANKED_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

/** Ranks every playing-this-week player within their position by this
 * week's value - mutates each entry in place since the index was just
 * built fresh here and nothing else holds a reference to it yet. */
function assignWeekRanks(index: Map<string, PlayerValueEntry>): void {
  const byPosition = new Map<string, PlayerValueEntry[]>();
  for (const entry of index.values()) {
    if (entry.opponent == null || !RANKED_POSITIONS.includes(entry.position)) continue;
    const list = byPosition.get(entry.position) ?? [];
    list.push(entry);
    byPosition.set(entry.position, list);
  }
  for (const entries of byPosition.values()) {
    entries.sort((a, b) => b.value - a.value);
    entries.forEach((entry, i) => {
      entry.weekRank = i + 1;
    });
  }
}

/**
 * Builds one league-scoring-accurate value per player from already-fetched
 * live data: up to a few completed weeks of actuals (oldest first, for
 * season/recency averages and matchup multipliers) plus the upcoming
 * week's projections. Pure function - all the fetching lives in
 * hooks/useSeasonPlayerValues.ts, this just does the math so it stays
 * testable and reusable (bid engine, trade finder, alerts, drop candidates
 * all consume this same index rather than recomputing).
 */
export function buildPlayerValueIndex(
  completedWeeksStats: StatRecord[][],
  nextWeekProjections: StatRecord[],
  scoringSettings: Record<string, number>,
): Map<string, PlayerValueEntry> {
  const avgPtsAllowed = averageAcrossWeeks(
    completedWeeksStats.map((week) => computeWeekPtsAllowed(week, scoringSettings)),
  );
  const leagueAvg = leagueAverageByPosition(avgPtsAllowed);

  const statsByPlayer = new Map<string, StatRecord[]>();
  for (const week of completedWeeksStats) {
    for (const rec of week) {
      if (!rec.player) continue;
      const list = statsByPlayer.get(rec.player_id) ?? [];
      list.push(rec);
      statsByPlayer.set(rec.player_id, list);
    }
  }

  const index = new Map<string, PlayerValueEntry>();

  for (const proj of nextWeekProjections) {
    if (!proj.player) continue;
    const history = (statsByPlayer.get(proj.player_id) ?? []).map((r) => r.stats);
    const mult = matchupMultiplier(proj.opponent, proj.player.position, avgPtsAllowed, leagueAvg);
    const value = computePlayerValue({
      playerId: proj.player_id,
      allSeasonWeeks: history,
      nextWeekProjection: proj.stats,
      scoringSettings,
      matchupMultiplier: mult,
    });
    index.set(proj.player_id, {
      ...value,
      name: `${proj.player.first_name} ${proj.player.last_name}`.trim(),
      position: proj.player.position,
      team: proj.team,
      opponent: proj.opponent,
      injuryStatus: proj.player.injury_status,
      weekRank: null,
    });
  }

  // Players with stat history but no projection this week (e.g. a bye) are
  // still needed for roster/exposure views - fall back to their recent
  // actuals with a neutral matchup multiplier instead of dropping them.
  for (const [playerId, records] of statsByPlayer) {
    if (index.has(playerId)) continue;
    const last = records[records.length - 1];
    if (!last.player) continue;
    const value = computePlayerValue({
      playerId,
      allSeasonWeeks: records.map((r) => r.stats),
      nextWeekProjection: null,
      scoringSettings,
      matchupMultiplier: 1,
    });
    index.set(playerId, {
      ...value,
      name: `${last.player.first_name} ${last.player.last_name}`.trim(),
      position: last.player.position,
      team: last.team,
      opponent: null,
      injuryStatus: last.player.injury_status,
      weekRank: null,
    });
  }

  assignWeekRanks(index);
  return index;
}
