import type { SleeperDraft } from "../types";

export interface ClockInfo {
  currentPickNo: number;
  round: number;
  slot: number;
  totalRounds: number;
  totalSlots: number;
}

/** settings.teams is set at draft creation and is always reliable. The
 * draft_order/slot_to_roster_id maps are a fallback for older data, but
 * can be incomplete depending on the draft's phase (e.g. before slots are
 * finalized) - relying on them alone caused totalSlots to under-count. */
function resolveTotalSlots(draft: SleeperDraft): number {
  if (draft.settings.teams && draft.settings.teams > 0) {
    return draft.settings.teams;
  }
  if (draft.draft_order) {
    const n = Object.keys(draft.draft_order).length;
    if (n > 0) return n;
  }
  if (draft.slot_to_roster_id) {
    const n = Object.keys(draft.slot_to_roster_id).length;
    if (n > 0) return n;
  }
  return 0;
}

/** Snake-draft math: given how many picks have been made, figure out whose
 * turn it is (by draft_slot) without needing the picks feed to say so. */
export function computeClock(
  draft: SleeperDraft,
  picksMade: number,
): ClockInfo | null {
  const totalSlots = resolveTotalSlots(draft);
  if (totalSlots === 0) return null;

  const currentPickNo = picksMade + 1;
  const round = Math.floor((currentPickNo - 1) / totalSlots) + 1;
  const positionInRound = ((currentPickNo - 1) % totalSlots) + 1;
  const slot = round % 2 === 1 ? positionInRound : totalSlots - positionInRound + 1;

  return {
    currentPickNo,
    round,
    slot,
    totalRounds: draft.settings.rounds,
    totalSlots,
  };
}
