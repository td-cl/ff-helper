import type { BidSuggestion } from "../lib/bidEngine";

interface Props {
  suggestion: BidSuggestion;
}

export function BidSuggestionBadge({ suggestion }: Props) {
  return (
    <span className="bid-suggestion">
      <span className="bid-amount">${suggestion.suggestedBid}</span>
      <span className={`confidence-badge confidence-${suggestion.confidenceLabel}`}>
        {suggestion.confidenceLabel.toUpperCase()}
      </span>
      {suggestion.sampleSize > 0 && (
        <span className="dim">based on {suggestion.sampleSize} similar bids</span>
      )}
    </span>
  );
}
