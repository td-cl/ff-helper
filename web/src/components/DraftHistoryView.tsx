import { useMemo, useState } from "react";
import type { EffectivePoolPlayer } from "../hooks/useCustomRankings";
import { buildHistoryPicks, groupByOwner, groupByRound, type HistoryPick } from "../lib/draftHistory";
import { positionClass } from "../lib/positionColors";
import type { DraftPick } from "../types";

interface Props {
  picks: DraftPick[];
  effectiveById: Map<string, EffectivePoolPlayer>;
  slotNames: Map<number, string>;
  onClose: () => void;
}

type GroupMode = "round" | "team";

function PickRow({ pick }: { pick: HistoryPick }) {
  return (
    <tr>
      <td>{pick.pick_no}</td>
      <td>{pick.ownerLabel}</td>
      <td>
        {pick.player ? (
          <>
            <span className={`pos-badge ${positionClass(pick.player.position)}`}>
              {pick.player.position}
            </span>{" "}
            {pick.player.name} <span className="dim">{pick.player.team ?? ""}</span>
          </>
        ) : (
          <span className="dim">{pick.metadataLabel ?? "Unknown player"}</span>
        )}
      </td>
    </tr>
  );
}

export function DraftHistoryView({ picks, effectiveById, slotNames, onClose }: Props) {
  const [mode, setMode] = useState<GroupMode>("round");

  const historyPicks = useMemo(
    () => buildHistoryPicks(picks, effectiveById, slotNames),
    [picks, effectiveById, slotNames],
  );

  const roundGroups = useMemo(() => groupByRound(historyPicks), [historyPicks]);
  const ownerGroups = useMemo(() => groupByOwner(historyPicks), [historyPicks]);

  const sections = useMemo(() => {
    if (mode === "round") {
      return [...roundGroups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([round, rows]) => ({
          key: `round-${round}`,
          label: `Round ${round}`,
          rows: rows.slice().sort((a, b) => a.pick_no - b.pick_no),
        }));
    }
    return [...ownerGroups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([owner, rows]) => ({
        key: `owner-${owner}`,
        label: owner,
        rows: rows.slice().sort((a, b) => a.pick_no - b.pick_no),
      }));
  }, [mode, roundGroups, ownerGroups]);

  return (
    <div className="draft-history">
      <div className="draft-history-header">
        <h1>Draft History</h1>
        <button className="primary-button" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="controls">
        <div className="position-tabs">
          <button className={mode === "round" ? "active" : ""} onClick={() => setMode("round")}>
            By Round
          </button>
          <button className={mode === "team" ? "active" : ""} onClick={() => setMode("team")}>
            By Team
          </button>
        </div>
      </div>
      {historyPicks.length === 0 ? (
        <p className="empty-row">No picks yet.</p>
      ) : (
        sections.map((section) => (
          <div className="history-group" key={section.key}>
            <h2>{section.label}</h2>
            <table>
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Team</th>
                  <th>Player</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((p) => (
                  <PickRow key={p.pick_no} pick={p} />
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
