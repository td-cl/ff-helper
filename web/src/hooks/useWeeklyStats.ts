import { useEffect, useState } from "react";
import { getWeeklyStats } from "../api/sleeper";
import { cached } from "../lib/liveDataCache";
import type { StatRecord } from "../types";

// A completed week's actuals are final - cache generously.
const TTL_MS = 6 * 60 * 60 * 1000;

/** Live actuals for one completed week. Pass week < 1 (e.g. week 0 before
 * any games) to no-op - lets callers always call this hook a fixed number
 * of times (see useSeasonPlayerValues) regardless of how early in the
 * season it is, without violating the rules of hooks. */
export function useWeeklyStats(season: string, week: number) {
  const [data, setData] = useState<StatRecord[]>([]);
  const [loading, setLoading] = useState(week >= 1);

  useEffect(() => {
    if (week < 1) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    cached(`stats:${season}:${week}`, TTL_MS, () => getWeeklyStats(season, week))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [season, week]);

  return { data, loading };
}
