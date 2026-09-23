import { useEffect, useState } from "react";
import { getWeeklyProjections } from "../api/sleeper";
import { cached } from "../lib/liveDataCache";
import type { StatRecord } from "../types";

// The upcoming week's projections move during the week (injury reports,
// role changes) - short TTL so a page left open still drifts back in sync.
const TTL_MS = 15 * 60 * 1000;

export function useWeeklyProjections(season: string, week: number) {
  const [data, setData] = useState<StatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cached(`proj:${season}:${week}`, TTL_MS, () => getWeeklyProjections(season, week))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load projections");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [season, week]);

  return { data, loading, error };
}
