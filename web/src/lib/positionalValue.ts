import type { DraftPick, PoolPlayer } from "../types";

export type PositionSignal = "run" | "value" | "reach" | "neutral";

export interface PositionValue {
  position: string;
  windowPickCount: number;
  windowShare: number;
  windowTotal: number;
  remainingCount: number;
  remainingAvgRank: number | null;
  bestRemainingRank: number | null;
  rankGap: number | null;
  signal: PositionSignal;
  score: number;
}

const TRACKED_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
const DEPTH_TOP_N = 5;
const RUN_SCORE_THRESHOLD = 0.15;
const RUN_SHARE_THRESHOLD = 0.34;
const VALUE_SHARE_THRESHOLD = 0.1;
const RANK_GAP_VALUE_THRESHOLD = 6;
const RANK_GAP_REACH_THRESHOLD = -6;

/**
 * Picks made since my (myUserId's) last selection - the natural "what
 * happened while I was waiting" window, which scales automatically with
 * snake-draft turn order for my own slot instead of a fixed pick count.
 * Falls back to every pick made so far if I haven't picked yet. Mirrors
 * draftStore's `slot-${draft_slot}` fallback for autopicks made under my
 * own slot when picked_by came back empty.
 */
export function computeSinceMyLastPickWindow(
  picks: DraftPick[],
  myUserId: string,
  mySlot: number | null,
): DraftPick[] {
  const made = picks.filter((p) => p.player_id);
  for (let i = made.length - 1; i >= 0; i--) {
    const pick = made[i];
    const isMine = pick.picked_by
      ? pick.picked_by === myUserId
      : mySlot != null && pick.draft_slot === mySlot;
    if (isMine) {
      return made.slice(i + 1);
    }
  }
  return made;
}

/**
 * Combines a recent-picks "run" share with a remaining-depth score to flag
 * positions worth pivoting away from (heavily picked recently AND thinning
 * out) versus positions worth targeting now. "Untouched recently" alone
 * isn't enough to call a position a value, though - QB/TE are quiet in
 * rounds 1-2 simply because nobody drafts them that early, not because
 * they're a bargain. VALUE additionally requires that the position's best
 * remaining player's rank actually supports being taken at the current
 * pick (rankGap); when it's quiet but the best remaining talent is ranked
 * well below the current pick, that's flagged as REACH instead - a caution
 * that taking it now would mean reaching beyond what rankings support.
 * Kept as simple, explainable arithmetic rather than a scoring model.
 *
 * The since-my-last-pick window is floored at one team-cycle (teams - 1
 * picks - one trip through every other team) whenever it's smaller than
 * that. Edge draft slots otherwise swing between an empty window (right
 * after a back-to-back "turn" pick) and a full round, which lets a single
 * pick flip a signal - the floor keeps the sample big enough for the
 * windowShare thresholds to mean something regardless of draft slot.
 */
export function computePositionalValue(
  picks: DraftPick[],
  draftedIds: Set<string>,
  pool: PoolPlayer[],
  myUserId: string,
  mySlot: number | null,
  currentPickNo: number | null,
  teams: number | null,
): PositionValue[] {
  const sinceMyLastPick = computeSinceMyLastPickWindow(picks, myUserId, mySlot);
  const floorSize = teams != null && teams > 1 ? teams - 1 : 0;
  const windowPicks =
    sinceMyLastPick.length >= floorSize
      ? sinceMyLastPick
      : picks.filter((p) => p.player_id).slice(-floorSize);
  const byId = new Map(pool.map((p) => [p.sleeper_id, p]));

  const windowCounts: Partial<Record<string, number>> = {};
  let windowTotal = 0;
  for (const pick of windowPicks) {
    const player = byId.get(pick.player_id);
    if (!player || !(TRACKED_POSITIONS as readonly string[]).includes(player.position)) continue;
    windowCounts[player.position] = (windowCounts[player.position] ?? 0) + 1;
    windowTotal++;
  }

  const remainingCountByPos: Record<string, number> = {};
  const remainingAvgRankByPos: Record<string, number | null> = {};
  const bestRemainingRankByPos: Record<string, number | null> = {};
  for (const pos of TRACKED_POSITIONS) {
    const undrafted = pool
      .filter((p) => p.position === pos && !draftedIds.has(p.sleeper_id) && p.blended_rank != null)
      .sort((a, b) => a.blended_rank! - b.blended_rank!);
    remainingCountByPos[pos] = undrafted.length;
    const top = undrafted.slice(0, DEPTH_TOP_N);
    remainingAvgRankByPos[pos] =
      top.length > 0 ? top.reduce((sum, p) => sum + p.rank, 0) / top.length : null;
    bestRemainingRankByPos[pos] = undrafted[0]?.rank ?? null;
  }

  // Rank tracked positions by remaining depth quality (worse/higher avg rank,
  // or no undrafted players left at all, is "thinner"). Ordinal comparison
  // self-corrects across pool sizes instead of needing an absolute scale.
  const byThinness = [...TRACKED_POSITIONS].sort((a, b) => {
    const ra = remainingAvgRankByPos[a];
    const rb = remainingAvgRankByPos[b];
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1;
    if (rb == null) return -1;
    return ra - rb;
  });
  const denom = TRACKED_POSITIONS.length - 1;
  const thinnessByPos: Record<string, number> = {};
  byThinness.forEach((pos, i) => {
    thinnessByPos[pos] = denom > 0 ? i / denom : 0;
  });

  return TRACKED_POSITIONS.map((pos) => {
    const windowPickCount = windowCounts[pos] ?? 0;
    const windowShare = windowTotal > 0 ? windowPickCount / windowTotal : 0;
    const thinness = thinnessByPos[pos];
    const score = windowShare * thinness;
    const bestRemainingRank = bestRemainingRankByPos[pos];
    const rankGap =
      currentPickNo != null && bestRemainingRank != null ? currentPickNo - bestRemainingRank : null;

    let signal: PositionSignal = "neutral";
    if (windowTotal > 0 && score >= RUN_SCORE_THRESHOLD && windowShare >= RUN_SHARE_THRESHOLD) {
      signal = "run";
    } else if (
      windowTotal > 0 &&
      windowShare <= VALUE_SHARE_THRESHOLD &&
      rankGap != null &&
      rankGap >= RANK_GAP_VALUE_THRESHOLD
    ) {
      signal = "value";
    } else if (
      windowTotal > 0 &&
      windowShare <= VALUE_SHARE_THRESHOLD &&
      rankGap != null &&
      rankGap <= RANK_GAP_REACH_THRESHOLD
    ) {
      signal = "reach";
    }

    return {
      position: pos,
      windowPickCount,
      windowShare,
      windowTotal,
      remainingCount: remainingCountByPos[pos],
      remainingAvgRank: remainingAvgRankByPos[pos],
      bestRemainingRank,
      rankGap,
      signal,
      score,
    };
  });
}
