const KNOWN_POSITIONS = ["QB", "RB", "WR", "TE", "FLEX", "DEF", "K", "BN"];

/** CSS class for a position's color-coded badge (see .pos-* rules in App.css). */
export function positionClass(position: string): string {
  const key = KNOWN_POSITIONS.includes(position) ? position : "BN";
  return `pos-${key.toLowerCase()}`;
}
