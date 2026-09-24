export interface SlottedPlayer {
  slot: string;
  playerId: string;
}

export interface SlottedRoster {
  starters: SlottedPlayer[];
  bench: string[];
  ir: string[];
}

/**
 * Lays a roster out the way Sleeper's own roster page does: starters in
 * their league's exact slot order (QB, RB, RB, WR, WR, TE, FLEX, FLEX, K,
 * DEF, ...), then bench, then IR - rather than an arbitrary players-array
 * order. Sleeper's `roster.starters` array is already positionally aligned
 * with `league.roster_positions` (minus its "BN" entries) - starters[i]
 * occupies roster_positions-without-BN[i] - so zipping them together
 * assigns each starter to its actual slot (which RB is in "RB" vs "FLEX",
 * etc.) without having to guess from the player's own position.
 */
export function buildSlottedRoster(
  rosterPositions: string[],
  starters: string[],
  players: string[],
  reserve: string[],
): SlottedRoster {
  const startingSlots = rosterPositions.filter((p) => p !== "BN");
  const slottedStarters: SlottedPlayer[] = starters
    .map((playerId, i) => ({ slot: startingSlots[i] ?? "FLEX", playerId }))
    .filter((s) => s.playerId && s.playerId !== "0");

  const starterIds = new Set(starters);
  const reserveIds = new Set(reserve);
  const bench = players.filter((id) => !starterIds.has(id) && !reserveIds.has(id));
  const ir = players.filter((id) => reserveIds.has(id));

  return { starters: slottedStarters, bench, ir };
}
