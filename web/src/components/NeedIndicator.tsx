import { positionClass } from "../lib/positionColors";
import type { PositionNeed } from "../lib/positionalNeed";

interface Props {
  needs: PositionNeed[];
}

export function NeedIndicator({ needs }: Props) {
  return (
    <ul>
      {needs.map((n) => (
        <li key={n.position} className={n.remaining > 0 ? "need" : "filled"}>
          <span className={`pos-badge ${positionClass(n.position)}`}>{n.position}</span>
          <span>
            {n.filled}/{n.target}
          </span>
          {n.remaining > 0 && <span className="need-tag">need {n.remaining}</span>}
        </li>
      ))}
    </ul>
  );
}
