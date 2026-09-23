import { positionClass } from "../lib/positionColors";
import type { PositionValue } from "../lib/positionalValue";

interface Props {
  values: PositionValue[];
  hasPicks: boolean;
}

function signalLabel(signal: PositionValue["signal"]): string {
  if (signal === "run") return "RUN";
  if (signal === "value") return "VALUE";
  if (signal === "reach") return "REACH";
  return "WATCH";
}

function rankGapNote(v: PositionValue): string | null {
  if (v.rankGap == null || v.bestRemainingRank == null) return null;
  if (v.signal === "value") return `best rank ${v.bestRemainingRank} fell ${v.rankGap} picks`;
  if (v.signal === "reach") return `best rank ${v.bestRemainingRank}, ${-v.rankGap} above pick`;
  return null;
}

export function PositionalValueWidget({ values, hasPicks }: Props) {
  if (!hasPicks) {
    return <p className="empty-row">Waiting for the draft to start...</p>;
  }
  return (
    <ul>
      {values.map((v) => {
        const label = signalLabel(v.signal);
        const note = rankGapNote(v);
        return (
          <li key={v.position}>
            <span className={`pos-badge ${positionClass(v.position)}`}>{v.position}</span>
            <span className="dim">
              {note ?? `${v.windowPickCount} of ${v.windowTotal} recent picks`}
            </span>
            <span className={`signal-chip signal-${v.signal}`}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
