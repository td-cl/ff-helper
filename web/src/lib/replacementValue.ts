import type { PlayerValueEntry } from "./playerValuesIndex";

const TRACKED_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const FLEX_SLOTS = ["FLEX", "WRRB_FLEX", "REC_FLEX", "WR_RB"];
const FLEX_ELIGIBLE = ["RB", "WR", "TE"];
const SUPER_FLEX_ELIGIBLE = ["QB", "RB", "WR", "TE"];
// Cushion past exact starter demand - "replacement level" means the last
// realistic streaming option, not the single worst startable player.
const BENCH_BUFFER = 2;

/**
 * League-wide starter demand per position: dedicated slots (QB, RB, ...)
 * times team count, plus a share of FLEX/SUPER_FLEX demand split evenly
 * across the positions eligible for that slot type. Doesn't weight the
 * split by how often each position actually fills a flex spot in
 * practice - a documented simplification, but a real improvement over
 * ignoring flex demand entirely (which would undercount RB/WR/TE need and
 * overstate how much a raw-points QB is worth by comparison).
 */
function demandByPosition(rosterPositions: string[], totalRosters: number): Map<string, number> {
  const perTeam = new Map<string, number>(TRACKED_POSITIONS.map((p) => [p, 0]));
  let flexSlots = 0;
  let superFlexSlots = 0;
  for (const slot of rosterPositions) {
    if (FLEX_SLOTS.includes(slot)) flexSlots++;
    else if (slot === "SUPER_FLEX") superFlexSlots++;
    else if (perTeam.has(slot)) perTeam.set(slot, (perTeam.get(slot) ?? 0) + 1);
  }
  for (const pos of FLEX_ELIGIBLE) {
    perTeam.set(pos, (perTeam.get(pos) ?? 0) + flexSlots / FLEX_ELIGIBLE.length);
  }
  for (const pos of SUPER_FLEX_ELIGIBLE) {
    perTeam.set(pos, (perTeam.get(pos) ?? 0) + superFlexSlots / SUPER_FLEX_ELIGIBLE.length);
  }
  const demand = new Map<string, number>();
  for (const [pos, count] of perTeam) demand.set(pos, count * totalRosters);
  return demand;
}

/**
 * This week's value of the last realistically-streamable player at each
 * position - the baseline "value over replacement" (VORP) is measured
 * against. Sorting waiver targets by raw value favors whichever position
 * scores the most raw points regardless of how deep that position runs
 * (QB and K, usually) - VORP instead asks "how much better is this than
 * what's already sitting on everyone's waiver wire," which is what
 * actually matters for a pickup decision.
 */
export function computeReplacementLevels(
  values: Map<string, PlayerValueEntry>,
  rosterPositions: string[],
  totalRosters: number,
): Map<string, number> {
  const demand = demandByPosition(rosterPositions, totalRosters);
  const sortedByPosition = new Map<string, number[]>();
  for (const entry of values.values()) {
    if (!TRACKED_POSITIONS.includes(entry.position)) continue;
    const list = sortedByPosition.get(entry.position) ?? [];
    list.push(entry.value);
    sortedByPosition.set(entry.position, list);
  }

  const levels = new Map<string, number>();
  for (const position of TRACKED_POSITIONS) {
    const sorted = (sortedByPosition.get(position) ?? []).sort((a, b) => b - a);
    if (sorted.length === 0) continue;
    const replacementRank = Math.round(demand.get(position) ?? 0) + BENCH_BUFFER;
    levels.set(position, sorted[Math.min(replacementRank, sorted.length - 1)]);
  }
  return levels;
}

export function valueOverReplacement(entry: PlayerValueEntry, levels: Map<string, number>): number {
  return entry.value - (levels.get(entry.position) ?? 0);
}
