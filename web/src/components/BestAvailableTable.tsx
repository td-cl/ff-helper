import { useMemo, useState } from "react";
import type { EffectivePoolPlayer } from "../hooks/useCustomRankings";
import { positionClass } from "../lib/positionColors";
import { fallAmount, fallThreshold } from "../lib/valueAlert";
import { PositionFilterTabs, type PositionFilter } from "./PositionFilterTabs";

/** Shows which source(s) fed a player's blended rank, e.g. "ECR 4 · Custom 1". */
function sourceNote(p: EffectivePoolPlayer): string | null {
  const parts: string[] = [];
  if (p.rank_ecr != null) parts.push(`ECR ${p.rank_ecr}`);
  if (p.rank_custom != null) parts.push(`Custom ${p.rank_custom}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface Props {
  pool: EffectivePoolPlayer[]; // pre-sorted by effectiveRank ascending
  draftedIds: Set<string>;
  recommendedIds: Set<string>;
  currentPickNo: number | null;
  totalSlots: number | null;
}

export function BestAvailableTable({
  pool,
  draftedIds,
  recommendedIds,
  currentPickNo,
  totalSlots,
}: Props) {
  const [position, setPosition] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");
  const threshold = fallThreshold(totalSlots);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool
      .filter((p) => !draftedIds.has(p.sleeper_id))
      .filter((p) => position === "ALL" || p.position === position)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 100);
  }, [pool, draftedIds, position, search]);

  return (
    <div className="panel best-available">
      <h2>Best Available</h2>
      <div className="controls">
        <PositionFilterTabs value={position} onChange={setPosition} />
        <input
          className="search-box"
          placeholder="Search player..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {available.map((p) => {
            const isRecommended = recommendedIds.has(p.sleeper_id);
            const fell =
              currentPickNo != null && fallAmount(p.effectiveRank, currentPickNo) >= threshold;
            const rowClasses = [
              !p.matched ? "unranked" : "",
              isRecommended ? "recommended-row" : "",
              fell ? "value-row" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={p.sleeper_id} className={rowClasses || undefined}>
                <td>
                  {p.effectiveRank}
                  {sourceNote(p) && <span className="dim ecr-note"> ({sourceNote(p)})</span>}
                </td>
                <td>
                  {p.name}
                  {isRecommended && <span className="badge badge-pick">PICK</span>}
                  {fell && (
                    <span className="badge badge-value">
                      +{fallAmount(p.effectiveRank, currentPickNo!)}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`pos-badge ${positionClass(p.position)}`}>{p.position}</span>
                </td>
                <td>{p.team ?? "-"}</td>
                <td>{p.tier ?? "-"}</td>
              </tr>
            );
          })}
          {available.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                No players match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
