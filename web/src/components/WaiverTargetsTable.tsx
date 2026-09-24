import { positionClass } from "../lib/positionColors";
import type { BidSuggestion } from "../lib/bidEngine";
import type { PlayerValueEntry } from "../lib/playerValuesIndex";
import { BidSuggestionBadge } from "./BidSuggestionBadge";

export interface WaiverTarget {
  playerId: string;
  value: PlayerValueEntry;
  trendingCount: number;
  bid: BidSuggestion;
  /** value.value minus this position's replacement-level value - what
   * this pickup is actually worth above the waiver-wire baseline at its
   * position, not just its raw points. Targets are ranked by this, not by
   * value.value directly, so it doesn't structurally favor whichever
   * position scores the most raw points (QB, usually). */
  valueAdd: number;
}

interface Props {
  targets: WaiverTarget[];
  week: number | null;
}

function trendArrow(trendDelta: number | null): string | null {
  if (trendDelta == null || Math.abs(trendDelta) < 1) return null;
  return trendDelta > 0 ? "▲" : "▼";
}

export function WaiverTargetsTable({ targets, week }: Props) {
  if (targets.length === 0) {
    return <p className="empty-row">No trending pickups available in this league right now.</p>;
  }
  const weekLabel = week != null ? `Wk ${week}` : "";
  return (
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th>{weekLabel} Value</th>
          <th>Value Add</th>
          <th>Matchup</th>
          <th>Trending</th>
          <th>Suggested Bid</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((t) => {
          const arrow = trendArrow(t.value.trendDelta);
          return (
            <tr key={t.playerId}>
              <td>
                <span className={`pos-badge ${positionClass(t.value.position)}`}>{t.value.position}</span>{" "}
                {t.value.name}
                {t.value.team ? ` (${t.value.team})` : ""}
              </td>
              <td>
                {t.value.value.toFixed(1)}
                {arrow && <span className="dim"> {arrow}</span>}
              </td>
              <td className={t.valueAdd > 0 ? "value-add-positive" : "dim"}>
                {t.valueAdd > 0 ? "+" : ""}
                {t.valueAdd.toFixed(1)}
              </td>
              <td className="dim">
                {t.value.opponent ? `${(t.value.matchupMultiplier * 100 - 100).toFixed(0)}% vs ${t.value.opponent}` : "bye"}
              </td>
              <td className="dim">{t.trendingCount.toLocaleString()} adds</td>
              <td>
                <BidSuggestionBadge suggestion={t.bid} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
