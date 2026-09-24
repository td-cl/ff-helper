import { useEffect, useState } from "react";
import { getUserLeagues } from "../api/sleeper";
import type { SleeperLeague } from "../types";

/** Every league.status === "in_season" league for this user - shared by
 * SeasonDashboard (the full list of cards) and LeagueView (the in-header
 * league switcher), so both stay in sync off one fetch pattern. */
export function useInSeasonLeagues(myUserId: string) {
  const [leagues, setLeagues] = useState<SleeperLeague[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserLeagues(myUserId, String(new Date().getFullYear()))
      .then((result) => {
        if (!cancelled) setLeagues(result.filter((l) => l.status === "in_season"));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your leagues from Sleeper.");
      });
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  return { leagues, error };
}
