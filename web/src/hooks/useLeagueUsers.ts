import { useEffect, useState } from "react";
import { getLeagueUsers } from "../api/sleeper";
import type { LeagueUser } from "../types";

export function useLeagueUsers(leagueId: string | null) {
  const [data, setData] = useState<LeagueUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLeagueUsers(leagueId)
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
