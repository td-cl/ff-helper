import { useEffect, useState } from "react";
import { getTradeValues, type TradeValueParams } from "../api/fantasycalc";
import { cached } from "../lib/liveDataCache";
import type { FantasyCalcValue } from "../types";

// Trade values move slowly day to day - long TTL keeps this to one fetch
// per session in the common case.
const TTL_MS = 12 * 60 * 60 * 1000;

export function useTradeValues(params: TradeValueParams) {
  const [data, setData] = useState<FantasyCalcValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = `fc:${params.isDynasty}:${params.numQbs}:${params.numTeams}:${params.ppr}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cached(key, TTL_MS, () => getTradeValues(params))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load trade values");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // key already encodes every param that should re-trigger a fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error };
}
