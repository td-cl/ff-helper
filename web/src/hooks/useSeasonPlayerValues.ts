import { useMemo } from "react";
import { buildPlayerValueIndex, type PlayerValueEntry } from "../lib/playerValuesIndex";
import { useWeeklyProjections } from "./useWeeklyProjections";
import { useWeeklyStats } from "./useWeeklyStats";

/**
 * League-scoring-accurate player values for every player appearing in the
 * upcoming week's projections or the last few completed weeks' actuals.
 * Always calls useWeeklyStats exactly 3 times (weeks currentWeek-1..-3) so
 * the hook count stays fixed regardless of how early in the season it is -
 * useWeeklyStats itself no-ops for week < 1.
 */
export function useSeasonPlayerValues(
  season: string,
  currentWeek: number,
  scoringSettings: Record<string, number> | null,
) {
  const w1 = currentWeek - 1;
  const w2 = currentWeek - 2;
  const w3 = currentWeek - 3;
  const stats1 = useWeeklyStats(season, w1);
  const stats2 = useWeeklyStats(season, w2);
  const stats3 = useWeeklyStats(season, w3);
  const projections = useWeeklyProjections(season, currentWeek);

  const loading = stats1.loading || stats2.loading || stats3.loading || projections.loading;

  const index = useMemo(() => {
    if (!scoringSettings) return new Map<string, PlayerValueEntry>();
    const completedWeeksStats = [
      { week: w3, data: stats3.data },
      { week: w2, data: stats2.data },
      { week: w1, data: stats1.data },
    ]
      .filter((w) => w.week >= 1)
      .map((w) => w.data);
    return buildPlayerValueIndex(completedWeeksStats, projections.data, scoringSettings);
  }, [stats1.data, stats2.data, stats3.data, projections.data, scoringSettings, w1, w2, w3]);

  return { index, loading };
}
