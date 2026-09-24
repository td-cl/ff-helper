import { useEffect, useState } from "react";
import { getLeagueRosters } from "../api/sleeper";
import type { LeagueRoster } from "../types";

export function useLeagueRosters(leagueId: string | null) {
  const [data, setData] = useState<LeagueRoster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLeagueRosters(leagueId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  return { data, loading };
}
