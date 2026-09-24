import type { DraftSettings } from "../types";

const STARTER_POSITIONS = ["QB", "RB", "WR", "TE", "DEF", "K"] as const;
type StarterPosition = (typeof STARTER_POSITIONS)[number];
const FLEX_ELIGIBLE: StarterPosition[] = ["RB", "WR", "TE"];

// Fixed display order so the sidebar never reshuffles as slots fill up.
const DISPLAY_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "DEF", "K", "BN"] as const;

export interface PositionNeed {
  position: string;
  target: number;
  filled: number;
  remaining: number;
}

/**
 * Derives starting-slot (and bench) needs directly from the draft's own
 * settings (slots_qb/rb/wr/te/flex/bn/...) rather than a hardcoded roster
 * shape, so this works correctly for any league's specific settings.
 * Always returns entries in a fixed position order - callers should not
 * re-sort by remaining/urgency, since the UI relies on a stable row order.
 */
export function computePositionalNeeds(
  settings: DraftSettings,
  rosterPositions: string[],
): PositionNeed[] {
  const targets: Record<StarterPosition, number> = {
    QB: settings.slots_qb ?? 0,
    RB: settings.slots_rb ?? 0,
    WR: settings.slots_wr ?? 0,
    TE: settings.slots_te ?? 0,
    DEF: settings.slots_def ?? 0,
    K: settings.slots_k ?? 0,
  };
  const flexTarget = (settings.slots_flex ?? 0) + (settings.slots_super_flex ?? 0);
  const benchTarget = settings.slots_bn ?? 0;

  const counts: Record<StarterPosition, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    DEF: 0,
    K: 0,
  };
  for (const pos of rosterPositions) {
    if (pos in counts) counts[pos as StarterPosition]++;
  }

  const dedicatedFilled: Record<StarterPosition, number> = {} as Record<
    StarterPosition,
    number
  >;
  const leftover: Record<StarterPosition, number> = {} as Record<
    StarterPosition,
    number
  >;
  for (const pos of STARTER_POSITIONS) {
    dedicatedFilled[pos] = Math.min(counts[pos], targets[pos]);
    leftover[pos] = Math.max(0, counts[pos] - targets[pos]);
  }

  let flexFilled = 0;
  for (const pos of FLEX_ELIGIBLE) {
    const take = Math.min(leftover[pos], flexTarget - flexFilled);
    flexFilled += take;
  }

  const startersFilled =
    STARTER_POSITIONS.reduce((sum, pos) => sum + dedicatedFilled[pos], 0) + flexFilled;
  const benchFilled = Math.min(benchTarget, Math.max(0, rosterPositions.length - startersFilled));

  const byPosition: Record<string, PositionNeed> = {};
  for (const pos of STARTER_POSITIONS) {
    if (targets[pos] > 0) {
      byPosition[pos] = {
        position: pos,
        target: targets[pos],
        filled: dedicatedFilled[pos],
        remaining: Math.max(0, targets[pos] - dedicatedFilled[pos]),
      };
    }
  }
  if (flexTarget > 0) {
    byPosition.FLEX = {
      position: "FLEX",
      target: flexTarget,
      filled: flexFilled,
      remaining: Math.max(0, flexTarget - flexFilled),
    };
  }
  if (benchTarget > 0) {
    byPosition.BN = {
      position: "BN",
      target: benchTarget,
      filled: benchFilled,
      remaining: Math.max(0, benchTarget - benchFilled),
    };
  }

  return DISPLAY_ORDER.filter((pos) => pos in byPosition).map((pos) => byPosition[pos]);
}

/**
 * Adapts a league's `roster_positions` slot list (Sleeper's in-season
 * shape - one entry per roster slot, e.g. ["QB","RB","RB",...,"BN","BN"])
 * into the slots_* target-count shape computePositionalNeeds expects
 * (Sleeper's draft-settings shape). Lets season-mode features (waiver
 * needs, trade finder, drop candidates) reuse the same need calculation
 * the draft flow already has, without a second implementation.
 */
export function slotSettingsFromRosterPositions(rosterPositions: string[]): DraftSettings {
  const settings: DraftSettings = { rounds: 0 };
  for (const slot of rosterPositions) {
    if (slot === "BN") {
      settings.slots_bn = (settings.slots_bn ?? 0) + 1;
    } else if (slot === "FLEX" || slot === "WRRB_FLEX" || slot === "REC_FLEX" || slot === "WR_RB") {
      // Sleeper uses several flex-slot spellings across leagues - all
      // treated as one pool here, matching FLEX_ELIGIBLE's RB/WR/TE range.
      settings.slots_flex = (settings.slots_flex ?? 0) + 1;
    } else if (slot === "SUPER_FLEX") {
      settings.slots_super_flex = (settings.slots_super_flex ?? 0) + 1;
    } else if (slot === "QB" || slot === "RB" || slot === "WR" || slot === "TE" || slot === "DEF" || slot === "K") {
      const key = `slots_${slot.toLowerCase()}`;
      settings[key] = (settings[key] ?? 0) + 1;
    }
    // Other slot types (IDP, taxi markers, etc.) aren't tracked by
    // computePositionalNeeds and are intentionally ignored here too.
  }
  return settings;
}
