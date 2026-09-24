import type { PoolPlayer } from "../types";
import type { PositionNeed } from "./positionalNeed";

const FLEX_ELIGIBLE = ["RB", "WR", "TE"];

/**
 * Picks the single best-available player for each position the user's
 * roster still needs (including FLEX), by effective rank. Naturally
 * surfaces multiple recommended players at once when several positions
 * are still short - e.g. a top RB and a top WR could both be highlighted.
 * Bench slots are depth, not a "need", so they never drive a recommendation.
 */
export function computeRecommendedIds(
  poolSortedByRank: PoolPlayer[],
  draftedIds: Set<string>,
  needs: PositionNeed[],
): Set<string> {
  const recommended = new Set<string>();
  const available = poolSortedByRank.filter((p) => !draftedIds.has(p.sleeper_id));

  for (const need of needs) {
    if (need.remaining <= 0 || need.position === "BN") continue;

    const eligible = need.position === "FLEX" ? FLEX_ELIGIBLE : [need.position];
    const candidate = available.find(
      (p) => eligible.includes(p.position) && !recommended.has(p.sleeper_id),
    );
    if (candidate) recommended.add(candidate.sleeper_id);
  }

  return recommended;
}
