import { positionClass } from "../lib/positionColors";
import type { PlayerValueEntry } from "../lib/playerValuesIndex";

interface Props {
  playerId: string;
  value: PlayerValueEntry | undefined;
  week: number | null;
}

export function RosterCard({ playerId, value, week }: Props) {
  if (!value) {
    return (
      <li className="roster-card roster-card-unknown">
        <span className="dim">{playerId}</span>
      </li>
    );
  }

  const onBye = value.opponent == null;
  const hurt = value.injuryStatus && value.injuryStatus !== "Questionable";

  return (
    <li className="roster-card">
      <div className="roster-card-header">
        <span className={`pos-badge ${positionClass(value.position)}`}>{value.position}</span>
        {value.positionRank != null && (
          <span className="season-rank-tag">
            {value.position}
            {value.positionRank}
          </span>
        )}
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
