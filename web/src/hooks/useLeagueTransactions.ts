import { useEffect, useState } from "react";
import { getLeagueTransactions } from "../api/sleeper";
import { cached } from "../lib/liveDataCache";
import type { Transaction } from "../types";

const PAST_WEEK_TTL_MS = 24 * 60 * 60 * 1000;
const CURRENT_WEEK_TTL_MS = 10 * 60 * 1000;

/** Fetches every league transaction from week 1 through `throughWeek`
 * (merged), the raw material for lib/bidEngine.ts's FAAB history. Past
 * weeks are final and cached generously; the current week refreshes more
 * often since claims are still being decided. */
export function useLeagueTransactions(leagueId: string | null, throughWeek: number) {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || throughWeek < 1) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const weeks = Array.from({ length: throughWeek }, (_, i) => i + 1);
    Promise.all(
      weeks.map((week) =>
        cached(
          `tx:${leagueId}:${week}`,
          week === throughWeek ? CURRENT_WEEK_TTL_MS : PAST_WEEK_TTL_MS,
          () => getLeagueTransactions(leagueId, week),
        ),
      ),
    )
      .then((results) => {
        if (!cancelled) setData(results.flat());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, throughWeek]);

  return { data, loading };
}
