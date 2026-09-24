import type { Transaction } from "../types";
import type { PlayerValueEntry } from "./playerValuesIndex";

export interface BidHistoryEntry {
  rosterId: number;
  playerId: string;
  bidAmount: number;
  won: boolean;
  /** Current live value used as a stand-in for the player's value at the
   * time of the historical bid - day-by-day value reconstruction is out of
   * scope for v1. Fine for tiering "who bids what for a top-15 WR" - just
   * not exact to the week the bid actually happened. */
  playerValue: number | null;
}

/** Every waiver transaction (won or lost) in a league, flattened to one
 * entry per player added, carrying the bid amount and that player's value -
 * the raw material both suggestBid's bid estimate and its confidence score
 * are built from. */
export function buildBidHistory(
  transactions: Transaction[],
  valueByPlayerId: Map<string, PlayerValueEntry>,
): BidHistoryEntry[] {
  const entries: BidHistoryEntry[] = [];
  for (const tx of transactions) {
    if (tx.type !== "waiver" || !tx.settings || tx.settings.waiver_bid == null || !tx.adds) continue;
    for (const [playerId, rosterId] of Object.entries(tx.adds)) {
      entries.push({
        rosterId,
        playerId,
        bidAmount: tx.settings.waiver_bid,
        won: tx.status === "complete",
        playerValue: valueByPlayerId.get(playerId)?.value ?? null,
      });
    }
  }
  return entries;
}

export type ConfidenceLabel = "low" | "medium" | "high";

export interface BidSuggestion {
  suggestedBid: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  sampleSize: number;
}

// A bid history entry "competes" with the target if its player's value is
// within this band - wide enough to get a usable sample this early in the
// season, tight enough to stay a meaningful tier comparison.
const VALUE_TIER_WINDOW = 0.35;
const MIN_SAMPLE_FOR_CONFIDENCE = 5;
// When a league has too little bid history yet (week 3), fall back to a
// flat share of the total budget rather than guessing off a tiny sample.
const FALLBACK_BUDGET_SHARE = 0.05;
const LOW_BUDGET_THRESHOLD = 0.3;
const LOW_BUDGET_DISCOUNT = 0.85;

function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Suggested FAAB bid + confidence for one target player, built entirely
 * from this league's own bid history - leagues bid completely differently
 * depending on budget size and culture, so a suggestion from one league's
 * history is never applied to another.
 */
export function suggestBid(
  targetValue: number,
  bidHistory: BidHistoryEntry[],
  myBudgetRemaining: number,
  leagueBudgetTotal: number,
): BidSuggestion {
  const lower = targetValue * (1 - VALUE_TIER_WINDOW);
  const upper = targetValue * (1 + VALUE_TIER_WINDOW);
  const similarTier = bidHistory.filter(
    (e) => e.playerValue != null && e.playerValue >= lower && e.playerValue <= upper,
  );
  const wonAmounts = similarTier
    .filter((e) => e.won)
    .map((e) => e.bidAmount)
    .sort((a, b) => a - b);

  if (wonAmounts.length < MIN_SAMPLE_FOR_CONFIDENCE) {
    const fallback = Math.round(leagueBudgetTotal * FALLBACK_BUDGET_SHARE);
    return {
      suggestedBid: Math.max(0, Math.min(fallback, myBudgetRemaining)),
      confidence: 20,
      confidenceLabel: "low",
      sampleSize: wonAmounts.length,
    };
  }

  const typicalWin = median(wonAmounts);
  const budgetIsLow = myBudgetRemaining < leagueBudgetTotal * LOW_BUDGET_THRESHOLD;
  const suggestedBid = Math.max(
    0,
    Math.min(Math.round(typicalWin * (budgetIsLow ? LOW_BUDGET_DISCOUNT : 1)), myBudgetRemaining),
  );

  // More historical bidders per winning claim at this tier -> lower
  // confidence at the same price, since competition is what drives bids up.
  const competitorsPerWin = similarTier.length / wonAmounts.length;
  const confidence = Math.max(10, Math.min(95, Math.round(100 - competitorsPerWin * 15)));
  const confidenceLabel: ConfidenceLabel = confidence >= 70 ? "high" : confidence >= 40 ? "medium" : "low";

  return { suggestedBid, confidence, confidenceLabel, sampleSize: wonAmounts.length };
}
