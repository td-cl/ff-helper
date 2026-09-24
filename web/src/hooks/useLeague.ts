import { useEffect, useState } from "react";
import { getLeague } from "../api/sleeper";
import type { SleeperLeague } from "../types";

/** One league's full settings (scoring_settings, roster_positions, waiver
 * budget, etc.) - the getUserLeagues list call already returns this shape,
 * but League/Dashboard views are entered with just a league_id in hand. */
export function useLeague(leagueId: string | null) {
  const [league, setLeague] = useState<SleeperLeague | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setLeague(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLeague(leagueId)
      .then((result) => {
        if (!cancelled) {
          setLeague(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this league from Sleeper.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  return { league, loading, error };
}
