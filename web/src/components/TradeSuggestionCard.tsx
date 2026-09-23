import { positionClass } from "../lib/positionColors";
import type { TradeSuggestion } from "../lib/tradeFinder";
import type { FantasyCalcValue } from "../types";

interface Props {
  suggestion: TradeSuggestion;
  valuesById: Map<string, FantasyCalcValue>;
}

function PlayerChip({ value }: { value: FantasyCalcValue | undefined }) {
  if (!value) return null;
  return (
    <span className="trade-chip">
      <span className={`pos-badge ${positionClass(value.player.position)}`}>{value.player.position}</span>{" "}
      {value.player.name}
      <span className="dim"> ({value.value.toLocaleString()})</span>
    </span>
  );
}

export function TradeSuggestionCard({ suggestion, valuesById }: Props) {
  const giveVal = valuesById.get(suggestion.give);
  const getVal = valuesById.get(suggestion.get);
  return (
    <li className="trade-suggestion-card">
      <div className="trade-suggestion-header">
        <span className="dim">with {suggestion.withDisplayName}</span>
        <span className="dim">value gap {(suggestion.valueGapPct * 100).toFixed(0)}%</span>
      </div>
      <div className="trade-suggestion-body">
        <div>
          <span className="dim">You give</span>
          <PlayerChip value={giveVal} />
        </div>
        <span className="trade-arrow">⇄</span>
        <div>
          <span className="dim">You get</span>
          <PlayerChip value={getVal} />
        </div>
      </div>
      <p className="trade-rationale">{suggestion.rationale}</p>
    </li>
  );
}
