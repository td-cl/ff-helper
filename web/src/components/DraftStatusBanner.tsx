import { computeClock } from "../lib/draftClock";
import type { SleeperDraft } from "../types";

interface Props {
  draft: SleeperDraft | null;
  picksMade: number;
  error: string | null;
  slotNames: Map<number, string>;
}

export function DraftStatusBanner({ draft, picksMade, error, slotNames }: Props) {
  if (!draft) {
    return <div className="status-banner loading">Loading draft...</div>;
  }

  const clock = computeClock(draft, picksMade);

  return (
    <div className={`status-banner status-${draft.status}`}>
      <span className="status-pill">{draft.status.replace("_", " ")}</span>
      {clock && draft.status !== "complete" && (
        <span>
          Pick {clock.currentPickNo} &middot; Round {clock.round} &middot; On the clock:{" "}
          <strong>{slotNames.get(clock.slot) ?? `Slot ${clock.slot}`}</strong>
        </span>
      )}
      {draft.status === "complete" && <span>Draft complete.</span>}
      {error && <span className="error-text">connection issue, retrying: {error}</span>}
    </div>
  );
}
