import { useEffect, useState } from "react";
import { getTrendingPlayers } from "../api/sleeper";
import { cached } from "../lib/liveDataCache";

const TTL_MS = 5 * 60 * 1000;

export function useTrendingPlayers(type: "add" | "drop") {
  const [data, setData] = useState<{ player_id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cached(`trending:${type}`, TTL_MS, () => getTrendingPlayers(type, 24, 100))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return { data, loading };
}
