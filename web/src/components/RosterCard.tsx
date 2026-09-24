import { positionClass } from "../lib/positionColors";
import type { PlayerValueEntry } from "../lib/playerValuesIndex";

interface Props {
  playerId: string;
  value: PlayerValueEntry | undefined;
  week: number | null;
  /** The roster slot this player fills (e.g. "FLEX", "SUPER_FLEX") - shown
   * as a second badge only when it differs from the player's own position,
   * so a flexed RB reads "RB · FLEX" instead of a redundant "RB · RB". */
  slot?: string;
  /** Rest-of-season position rank (FantasyCalc redraft value rank) -
   * absent for players FantasyCalc doesn't value (deep bench, K/DEF). */
  rosRank?: number | null;
}

export function RosterCard({ playerId, value, week, slot, rosRank }: Props) {
  if (!value) {
    return (
      <li className="roster-card roster-card-unknown">
        <span className="dim">{playerId}</span>
      </li>
    );
  }

  const onBye = value.opponent == null;
  const hurt = value.injuryStatus && value.injuryStatus !== "Questionable";
  const showSlot = slot && slot !== value.position;
  // FLEX/SUPER_FLEX/WRRB_FLEX/etc. all read as the same purple "FLEX" tag.
  const slotColorKey = showSlot ? (slot.includes("FLEX") ? "FLEX" : slot) : null;

  return (
    <li className="roster-card">
      <div className="roster-card-header">
        <span className="roster-card-badges">
          <span className={`pos-badge ${positionClass(value.position)}`}>{value.position}</span>
          {showSlot && slotColorKey && (
            <span className={`pos-badge ${positionClass(slotColorKey)}`}>{slot}</span>
          )}
        </span>
        <span className="rank-tags">
          {value.weekRank != null && (
            <span className="rank-tag" title={`Rank at ${value.position} for week ${week}`}>
              <span className="rank-tag-label">Wk</span> {value.position}
              {value.weekRank}
            </span>
          )}
          {rosRank != null && (
            <span className="rank-tag" title={`Rest-of-season rank at ${value.position}`}>
              <span className="rank-tag-label">ROS</span> {value.position}
              {rosRank}
            </span>
          )}
        </span>
      </div>
      <span className="roster-card-name">{value.name}</span>
      <span className="dim">{value.team ?? "FA"}</span>
      <div className="roster-card-week">
        {onBye ? (
          <span className="dim">Bye week {week != null ? `(Wk ${week})` : ""}</span>
        ) : (
          <span>
            Wk {week} proj: <strong>{value.value.toFixed(1)}</strong> vs {value.opponent}
          </span>
        )}
      </div>
      {hurt && <span className="injury-tag">{value.injuryStatus}</span>}
    </li>
  );
}
