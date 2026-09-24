import { useCallback, useEffect, useMemo, useState } from "react";
import type { PoolPlayer } from "../types";

const STORAGE_KEY = "scouting-sage:custom-order:v1";

export interface EffectivePoolPlayer extends PoolPlayer {
  /** Rank after applying the user's manual reordering (1-based). */
  effectiveRank: number;
}

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null; // private browsing / storage disabled - just skip persistence
  }
}

function saveOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // ignore - custom order simply won't persist across reloads
  }
}

/**
 * Lets the user manually re-rank players (drag-free: move up/down or type
 * a target rank), persisted to localStorage so it survives reloads. The
 * override is a full ordering of sleeper_ids layered on top of the base
 * rankings file - anything not explicitly moved keeps its original
 * relative order, appended after whatever was customized.
 */
export function useCustomRankings(basePool: PoolPlayer[]) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrder(loadOrder());
    setHydrated(true);
  }, []);

  const effectivePool = useMemo<EffectivePoolPlayer[]>(() => {
    if (basePool.length === 0) return [];
    const byId = new Map(basePool.map((p) => [p.sleeper_id, p]));
    const ordered: PoolPlayer[] = [];

    if (order) {
      const seen = new Set<string>();
      for (const id of order) {
        const p = byId.get(id);
        if (p && !seen.has(id)) {
          ordered.push(p);
          seen.add(id);
        }
      }
      for (const p of basePool) {
        if (!seen.has(p.sleeper_id)) ordered.push(p);
      }
    } else {
      ordered.push(...basePool);
    }

    return ordered.map((p, i) => ({ ...p, effectiveRank: i + 1 }));
  }, [basePool, order]);

  const moveTo = useCallback(
    (sleeperId: string, newIndex: number) => {
      const ids = effectivePool.map((p) => p.sleeper_id);
      const fromIndex = ids.indexOf(sleeperId);
      if (fromIndex === -1) return;
      const next = [...ids];
      next.splice(fromIndex, 1);
      next.splice(Math.max(0, Math.min(newIndex, next.length)), 0, sleeperId);
      setOrder(next);
      saveOrder(next);
    },
    [effectivePool],
  );

  const moveUp = useCallback(
    (sleeperId: string) => {
      const idx = effectivePool.findIndex((p) => p.sleeper_id === sleeperId);
      if (idx > 0) moveTo(sleeperId, idx - 1);
    },
    [effectivePool, moveTo],
  );

  const moveDown = useCallback(
    (sleeperId: string) => {
      const idx = effectivePool.findIndex((p) => p.sleeper_id === sleeperId);
      if (idx !== -1) moveTo(sleeperId, idx + 1);
    },
    [effectivePool, moveTo],
  );

  const reset = useCallback(() => {
    setOrder(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    effectivePool,
    moveTo,
    moveUp,
    moveDown,
    reset,
    isCustomized: order != null,
    hydrated,
  };
}
