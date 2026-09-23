import { useEffect, useState } from "react";
import { getNflState } from "../api/sleeper";

export interface NflWeekState {
  week: number;
  season: string;
}

/** Current NFL week/season, used to anchor every in-season fetch (weekly
 * stats/projections, transactions-through-this-week). Fetched once and
 * shared by whichever season-mode screen is mounted. */
export function useNflState(): NflWeekState | null {
  const [state, setState] = useState<NflWeekState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNflState()
      .then((s) => {
        if (!cancelled) setState({ week: s.week, season: s.season });
      })
      .catch(() => {
        // Season mode simply stays in a loading state without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
