import { positionClass } from "../lib/positionColors";
import type { PoolPlayer } from "../types";

interface Props {
  myPlayers: PoolPlayer[];
}

export function MyRosterPanel({ myPlayers }: Props) {
  if (myPlayers.length === 0) {
    return <p className="empty-row">No picks yet.</p>;
  }
  return (
    <ul>
      {myPlayers.map((p) => (
        <li key={p.sleeper_id}>
          <span className={`pos-badge ${positionClass(p.position)}`}>{p.position}</span>{" "}
          {p.name} <span className="dim">{p.team ?? ""}</span>
        </li>
      ))}
    </ul>
  );
}
