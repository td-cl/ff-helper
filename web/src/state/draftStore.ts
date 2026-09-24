import type { DraftPick } from "../types";

export interface DraftState {
  picks: DraftPick[];
  draftedIds: Set<string>;
  /** picked_by (Sleeper user_id) -> player_ids drafted, in pick order.
   * Falls back to a synthetic "slot-N" key when picked_by is empty
   * (seen on some autopicks), so a drafter's players are never lost. */
  rostersByOwner: Map<string, string[]>;
}

export function buildDraftState(picks: DraftPick[]): DraftState {
  const draftedIds = new Set<string>();
  const rostersByOwner = new Map<string, string[]>();

  for (const pick of picks) {
    if (!pick.player_id) continue; // placeholder for a not-yet-made pick
    draftedIds.add(pick.player_id);
    const owner = pick.picked_by || `slot-${pick.draft_slot}`;
    const list = rostersByOwner.get(owner);
    if (list) {
      list.push(pick.player_id);
    } else {
      rostersByOwner.set(owner, [pick.player_id]);
    }
  }

  return { picks, draftedIds, rostersByOwner };
}
