import type { StatRecord } from "../types";
import { scoreStatLine } from "./scoringEngine";

/** team abbreviation -> position -> total custom-scored fantasy points its
 * defense allowed that week (or averaged across several weeks - see
 * averageAcrossWeeks). */
export type PtsAllowedByTeamPos = Map<string, Map<string, number>>;

/** Sums, for every team, how many custom-scored fantasy points its defense
 * gave up to each position in one week's worth of actual results. */
export function computeWeekPtsAllowed(
  records: StatRecord[],
  scoringSettings: Record<string, number>,
): PtsAllowedByTeamPos {
  const byTeamPos: PtsAllowedByTeamPos = new Map();
  for (const rec of records) {
    if (!rec.player || !rec.opponent) continue;
    const pts = scoreStatLine(rec.stats, scoringSettings);
    const posMap = byTeamPos.get(rec.opponent) ?? new Map<string, number>();
    posMap.set(rec.player.position, (posMap.get(rec.player.position) ?? 0) + pts);
    byTeamPos.set(rec.opponent, posMap);
  }
  return byTeamPos;
}

export function averageAcrossWeeks(weeks: PtsAllowedByTeamPos[]): PtsAllowedByTeamPos {
  const sums = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const week of weeks) {
    for (const [team, posMap] of week) {
      const target = sums.get(team) ?? new Map<string, { sum: number; n: number }>();
      for (const [pos, pts] of posMap) {
        const cell = target.get(pos) ?? { sum: 0, n: 0 };
        cell.sum += pts;
        cell.n += 1;
        target.set(pos, cell);
      }
      sums.set(team, target);
    }
  }
  const result: PtsAllowedByTeamPos = new Map();
  for (const [team, posMap] of sums) {
    const out = new Map<string, number>();
    for (const [pos, cell] of posMap) out.set(pos, cell.n > 0 ? cell.sum / cell.n : 0);
    result.set(team, out);
  }
  return result;
}

export function leagueAverageByPosition(avgByTeamPos: PtsAllowedByTeamPos): Map<string, number> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const posMap of avgByTeamPos.values()) {
    for (const [pos, pts] of posMap) {
      const cell = sums.get(pos) ?? { sum: 0, n: 0 };
      cell.sum += pts;
      cell.n += 1;
      sums.set(pos, cell);
    }
  }
  const out = new Map<string, number>();
  for (const [pos, cell] of sums) out.set(pos, cell.n > 0 ? cell.sum / cell.n : 0);
  return out;
}

// Clamp so a small early-season sample (week 3 = at most 2 completed weeks)
// can't swing a player's value wildly off a single fluky game.
const MIN_MULTIPLIER = 0.75;
const MAX_MULTIPLIER = 1.35;

/**
 * How much easier/harder than average this week's matchup is, relative to
 * the league's own scoring - 1.15 means the opponent has given up 15% more
 * than the league-average team allows at that position. Neutral (1) when
 * there's no opponent (bye) or not enough data yet.
 */
export function matchupMultiplier(
  opponentTeam: string | null,
  position: string,
  avgByTeamPos: PtsAllowedByTeamPos,
  leagueAvgByPosition: Map<string, number>,
): number {
  if (!opponentTeam) return 1;
  const teamAvg = avgByTeamPos.get(opponentTeam)?.get(position);
  const leagueAvg = leagueAvgByPosition.get(position);
  if (teamAvg == null || !leagueAvg) return 1;
  const raw = leagueAvg > 0 ? teamAvg / leagueAvg : 1;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, raw));
}
