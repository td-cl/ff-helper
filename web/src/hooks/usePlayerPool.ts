import { useEffect, useState } from "react";
import type { PoolPlayer } from "../types";

export interface PlayerPoolResult {
  pool: PoolPlayer[];
  byId: Map<string, PoolPlayer>;
  loading: boolean;
  error: string | null;
}

/** Loads the static player_pool.json built by data-prep/build_player_pool.py.
 * Regenerate that file the morning of the draft to refresh rankings. */
export function usePlayerPool(): PlayerPoolResult {
  const [pool, setPool] = useState<PoolPlayer[]>([]);
  const [byId, setById] = useState<Map<string, PoolPlayer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/player_pool.json")
      .then((res) => {
        if (!res.ok) throw new Error(`player_pool.json fetch failed: ${res.status}`);
        return res.json() as Promise<PoolPlayer[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setPool(data);
        setById(new Map(data.map((p) => [p.sleeper_id, p])));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load player_pool.json - run the data-prep scripts first",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pool, byId, loading, error };
}
