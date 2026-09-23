export const POSITION_FILTERS = ["ALL", "QB", "RB", "WR", "TE", "DEF", "K"] as const;
export type PositionFilter = (typeof POSITION_FILTERS)[number];

interface Props {
  value: PositionFilter;
  onChange: (value: PositionFilter) => void;
}

export function PositionFilterTabs({ value, onChange }: Props) {
  return (
    <div className="position-tabs">
      {POSITION_FILTERS.map((pos) => (
        <button
          key={pos}
          className={pos === value ? "active" : ""}
          onClick={() => onChange(pos)}
        >
          {pos}
        </button>
      ))}
    </div>
  );
}
