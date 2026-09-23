import { useMemo, useState } from "react";
import type { EffectivePoolPlayer } from "../hooks/useCustomRankings";
import { positionClass } from "../lib/positionColors";
import { PositionFilterTabs, type PositionFilter } from "./PositionFilterTabs";

interface Props {
  pool: EffectivePoolPlayer[];
  loading: boolean;
  error: string | null;
  isCustomized: boolean;
  onMoveTo: (id: string, newIndex: number) => void;
  onReset: () => void;
  onClose: () => void;
}

const VISIBLE_CAP = 300;

export function RankingsEditor({
  pool,
  loading,
  error,
  isCustomized,
  onMoveTo,
  onReset,
  onClose,
}: Props) {
  const [position, setPosition] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");
  const [rankDrafts, setRankDrafts] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pool;
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (position !== "ALL") {
      list = list.filter((p) => p.position === position);
    }
    return list.slice(0, VISIBLE_CAP);
  }, [pool, search, position]);

  function commitRank(id: string) {
    const raw = rankDrafts[id];
    if (raw === undefined) return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      onMoveTo(id, parsed - 1);
    }
    setRankDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleDrop(targetId: string) {
    setDragOverId(null);
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const newIndex = pool.findIndex((p) => p.sleeper_id === targetId);
    if (newIndex !== -1) onMoveTo(dragId, newIndex);
    setDragId(null);
  }

  return (
    <div className="rankings-editor">
      <div className="rankings-header">
        <h1>Rankings</h1>
        <div className="rankings-header-actions">
          {isCustomized && (
            <button
              className="link-button"
              onClick={() => {
                if (window.confirm("Reset all manual rank changes back to the default board?")) {
                  onReset();
                }
              }}
            >
              Reset to default
            </button>
          )}
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      <p className="rankings-hint">
        Adjust the board to match your own read on players before the draft starts. Move a player
        with the drag feature, or type a rank and press 'Enter' to jump it there. Changes are saved on
        this device session and used everywhere in the app.
      </p>
      <div className="controls">
        <PositionFilterTabs value={position} onChange={setPosition} />
        <input
          className="search-box"
          placeholder="Search player..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading && <p className="loading">Loading rankings...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th>ECR</th>
              <th>Custom</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                key={p.sleeper_id}
                className={
                  [dragId === p.sleeper_id ? "dragging" : "", dragOverId === p.sleeper_id ? "drag-over" : ""]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== p.sleeper_id) setDragOverId(p.sleeper_id);
                }}
                onDragLeave={() => setDragOverId((cur) => (cur === p.sleeper_id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(p.sleeper_id);
                }}
              >
                <td className="rank-cell">
                  <span
                    className="drag-handle"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", p.sleeper_id);
                      setDragId(p.sleeper_id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                  >
                    ⠿
                  </span>
                  <input
                    className="rank-input"
                    type="number"
                    min={1}
                    value={rankDrafts[p.sleeper_id] ?? p.effectiveRank}
                    onChange={(e) =>
                      setRankDrafts((prev) => ({ ...prev, [p.sleeper_id]: e.target.value }))
                    }
                    onBlur={() => commitRank(p.sleeper_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRank(p.sleeper_id);
                    }}
                  />
                </td>
                <td>{p.name}</td>
                <td>
                  <span className={`pos-badge ${positionClass(p.position)}`}>{p.position}</span>
                </td>
                <td>{p.team ?? "-"}</td>
                <td>{p.rank_ecr ?? "-"}</td>
                <td>{p.rank_custom ?? "-"}</td>
                <td>{p.tier ?? "-"}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No players match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
