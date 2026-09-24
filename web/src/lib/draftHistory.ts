import type { EffectivePoolPlayer } from "../hooks/useCustomRankings";
import type { DraftPick } from "../types";

export interface HistoryPick {
  pick_no: number;
  round: number;
  draft_slot: number;
  ownerLabel: string;
  player: EffectivePoolPlayer | null;
  metadataLabel: string | null;
}

/** Joins raw picks against the player pool and resolved slot names. Owner
 * label is keyed off draft_slot (via slotNames) rather than picked_by, since
 * slotNames is derived from slot_to_roster_id and so works uniformly whether
 * or not picked_by came back empty (as it does on some autopicks). */
export function buildHistoryPicks(
  picks: DraftPick[],
  effectiveById: Map<string, EffectivePoolPlayer>,
  slotNames: Map<number, string>,
): HistoryPick[] {
  return picks
    .filter((p) => p.player_id)
    .map((p) => {
      const first = p.metadata?.first_name;
      const last = p.metadata?.last_name;
      const metadataLabel = first || last ? `${first ?? ""} ${last ?? ""}`.trim() : null;
      return {
        pick_no: p.pick_no,
        round: p.round,
        draft_slot: p.draft_slot,
        ownerLabel: slotNames.get(p.draft_slot) ?? `Slot ${p.draft_slot}`,
        player: effectiveById.get(p.player_id) ?? null,
        metadataLabel,
      };
    });
}

export function groupByRound(picks: HistoryPick[]): Map<number, HistoryPick[]> {
  const map = new Map<number, HistoryPick[]>();
  for (const p of picks) {
    const list = map.get(p.round);
    if (list) list.push(p);
    else map.set(p.round, [p]);
  }
  return map;
}

export function groupByOwner(picks: HistoryPick[]): Map<string, HistoryPick[]> {
  const map = new Map<string, HistoryPick[]>();
  for (const p of picks) {
    const list = map.get(p.ownerLabel);
    if (list) list.push(p);
    else map.set(p.ownerLabel, [p]);
  }
  return map;
}
