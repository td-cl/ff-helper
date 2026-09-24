/** How many picks past their rank a player must fall before we flag it as
 * a value alert. Scaled to draft size when known (falling a full round past
 * your rank is notable in any league size); falls back to a flat default
 * pre-draft or if the draft's team count isn't available yet. */
const DEFAULT_THRESHOLD = 12;

export function fallThreshold(totalSlots: number | null): number {
  return totalSlots && totalSlots > 0 ? totalSlots : DEFAULT_THRESHOLD;
}

/** Positive when a player is still available well past their effective
 * rank - i.e. they've "fallen" in the draft relative to expectation. */
export function fallAmount(effectiveRank: number, currentPickNo: number): number {
  return currentPickNo - effectiveRank;
}
