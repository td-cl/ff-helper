/**
 * Turns a raw per-category stat line (the same shape Sleeper's live
 * projections/actuals endpoints return) into a single fantasy-point total,
 * using a league's own scoring_settings weights - so player value is exact
 * to that league's custom rules instead of a generic std/half/full-PPR
 * bucket. Kept as one small pure function, reused for both projections and
 * actuals (see lib/matchup.ts and lib/playerValuesIndex.ts).
 */
export function scoreStatLine(
  stats: Record<string, number> | undefined | null,
  scoringSettings: Record<string, number>,
): number {
  if (!stats) return 0;
  let total = 0;
  for (const key in stats) {
    const weight = scoringSettings[key];
    if (weight) total += stats[key] * weight;
  }
  return Math.round(total * 100) / 100;
}

// Most-recent-week-first weights for the recency-weighted average below -
// last week counts for more than three weeks ago, but a hot/cold week
// alone doesn't swing the number wildly.
const RECENCY_WEIGHTS = [0.5, 0.3, 0.2];

function weightedAverage(mostRecentFirstScores: number[]): number | null {
  if (mostRecentFirstScores.length === 0) return null;
  const weights = RECENCY_WEIGHTS.slice(0, mostRecentFirstScores.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const total = mostRecentFirstScores.reduce((sum, score, i) => sum + score * weights[i], 0);
  return total / weightSum;
}

export interface PlayerValue {
  playerId: string;
  /** Next week's custom-scored live projection (or, lacking one, the
   * recency-weighted average as a fallback - e.g. a bye-week player with
   * no projection this week still needs a value for roster/exposure views). */
  projectedPoints: number;
  matchupMultiplier: number;
  /** projectedPoints * matchupMultiplier - the single number every
   * downstream feature (bid suggestions, trade finder, alerts, drop
   * candidates) sorts and compares by. */
  value: number;
  recentAvg: number | null;
  seasonAvg: number | null;
  /** Sum of custom-scored points across every completed week played -
   * null until the player has played at least one game. Drives the
   * season-long positional rank shown on roster cards (see
   * lib/playerValuesIndex.ts's assignPositionalRanks). */
  seasonTotal: number | null;
  /** recentAvg - seasonAvg, surfaced separately for a UI trend arrow -
   * never folded silently into `value`. */
  trendDelta: number | null;
}

export interface ComputePlayerValueParams {
  playerId: string;
  /** Completed weeks' raw stat lines, oldest first. */
  allSeasonWeeks: Record<string, number>[];
  nextWeekProjection: Record<string, number> | null;
  scoringSettings: Record<string, number>;
  /** Opponent's points-allowed-to-position multiplier, 1 = neutral.
   * See lib/matchup.ts. */
  matchupMultiplier: number;
}

export function computePlayerValue(params: ComputePlayerValueParams): PlayerValue {
  const { playerId, allSeasonWeeks, nextWeekProjection, scoringSettings, matchupMultiplier } = params;

  const weekScores = allSeasonWeeks.map((week) => scoreStatLine(week, scoringSettings));
  const seasonTotal = weekScores.length > 0 ? Math.round(weekScores.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  const seasonAvg = weekScores.length > 0 ? seasonTotal! / weekScores.length : null;

  const recentMostRecentFirst = [...weekScores].slice(-3).reverse();
  const recentAvg = weightedAverage(recentMostRecentFirst);

  const projectedFromScoring = nextWeekProjection ? scoreStatLine(nextWeekProjection, scoringSettings) : null;
  const projectedPoints = projectedFromScoring ?? recentAvg ?? seasonAvg ?? 0;

  const value = Math.round(projectedPoints * matchupMultiplier * 100) / 100;
  const trendDelta = recentAvg != null && seasonAvg != null ? Math.round((recentAvg - seasonAvg) * 100) / 100 : null;

  return { playerId, projectedPoints, matchupMultiplier, value, recentAvg, seasonAvg, seasonTotal, trendDelta };
}
