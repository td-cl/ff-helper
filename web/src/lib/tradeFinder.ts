import type { FantasyCalcValue } from "../types";
import type { PositionNeed } from "./positionalNeed";

export type Momentum = "buy-low" | "sell-high" | "stable";

// trend30Day is FantasyCalc's absolute point change over the last 30 days,
// so the value 30 days ago was (value - trend30Day) - percentage change
// must be relative to THAT, not the current value, or a big swing produces
// a nonsensical >100%-magnitude reading (e.g. a player who fell from 1000
// to 300 is -70% from where they started, not -233% of where they landed).
// FantasyCalc already did the hard work (its values are "created from
// millions of real trades" per its own site); this just labels the
// momentum, no separate model needed.
const MOMENTUM_THRESHOLD = 0.15;

export function pctChange30Day(fc: FantasyCalcValue): number | null {
  const previousValue = fc.value - fc.trend30Day;
  if (previousValue <= 0) return null;
  return fc.trend30Day / previousValue;
}

export function classifyMomentum(fc: FantasyCalcValue): Momentum {
  const pctChange = pctChange30Day(fc);
  if (pctChange == null) return "stable";
  if (pctChange >= MOMENTUM_THRESHOLD) return "sell-high";
  if (pctChange <= -MOMENTUM_THRESHOLD) return "buy-low";
  return "stable";
}

export interface RosterInfo {
  rosterId: number;
  displayName: string;
  playerIds: string[];
}

export interface TradeSuggestion {
  withRosterId: number;
  withDisplayName: string;
  give: string;
  get: string;
  valueGapPct: number;
  rationale: string;
}

// How close a give/get pair's combined value must be to look realistic
// enough for the other manager to consider.
const MAX_VALUE_GAP = 0.15;
const MAX_SUGGESTIONS = 20;

function formatPct(x: number): string {
  const pct = Math.round(x * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/**
 * One-for-one trade suggestions between the signed-in user and each
 * leaguemate: a value-balanced pair where the incoming player is a buy-low
 * or fills a positional need, and/or the outgoing player is a sell-high -
 * classic value-arbitrage logic, built from FantasyCalc's momentum signal
 * plus this app's own positional-need calc. Package deals (2-for-1, etc.)
 * are a later refinement.
 */
export function suggestTrades(
  myRosterIds: string[],
  leaguemateRosters: RosterInfo[],
  valuesById: Map<string, FantasyCalcValue>,
  myNeeds: PositionNeed[],
  nameById: Map<string, string>,
): TradeSuggestion[] {
  const needPositions = new Set(myNeeds.filter((n) => n.remaining > 0).map((n) => n.position));
  const myTradeable = myRosterIds.filter((id) => valuesById.has(id));
  const suggestions: TradeSuggestion[] = [];

  for (const mate of leaguemateRosters) {
    const theirTradeable = mate.playerIds.filter((id) => valuesById.has(id));
    for (const giveId of myTradeable) {
      const giveVal = valuesById.get(giveId)!;
      const giveMomentum = classifyMomentum(giveVal);
      for (const getId of theirTradeable) {
        const getVal = valuesById.get(getId)!;
        const gap = Math.abs(giveVal.value - getVal.value) / Math.max(giveVal.value, getVal.value, 1);
        if (gap > MAX_VALUE_GAP) continue;

        const getMomentum = classifyMomentum(getVal);
        const fillsNeed = needPositions.has(getVal.player.position);
        const isSellHigh = giveMomentum === "sell-high";
        const isBuyLow = getMomentum === "buy-low";
        if (!fillsNeed && !isSellHigh && !isBuyLow) continue;

        const reasons: string[] = [];
        if (isSellHigh) {
          const pct = pctChange30Day(giveVal);
          reasons.push(
            `sell high on ${nameById.get(giveId) ?? giveId}${pct != null ? ` (${formatPct(pct)}, 30d)` : ""}`,
          );
        }
        if (isBuyLow) {
          const pct = pctChange30Day(getVal);
          reasons.push(
            `buy low on ${nameById.get(getId) ?? getId}${pct != null ? ` (${formatPct(pct)}, 30d)` : ""}`,
          );
        }
        if (fillsNeed) reasons.push(`fills your ${getVal.player.position} need`);

        suggestions.push({
          withRosterId: mate.rosterId,
          withDisplayName: mate.displayName,
          give: giveId,
          get: getId,
          valueGapPct: gap,
          rationale: reasons.join(", "),
        });
      }
    }
  }

  return suggestions.sort((a, b) => a.valueGapPct - b.valueGapPct).slice(0, MAX_SUGGESTIONS);
}
