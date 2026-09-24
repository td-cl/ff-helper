import type { FantasyCalcValue } from "../types";

const BASE = "https://api.fantasycalc.com";

export interface TradeValueParams {
  isDynasty: boolean;
  numQbs: number;
  numTeams: number;
  ppr: number;
}

/**
 * FantasyCalc's algorithmic trade values ("created from millions of real
 * trades" per fantasycalc.com) - a separate provider from Sleeper. Their
 * /api-docs page is a client-rendered SPA with nothing crawlable; this
 * endpoint and shape were verified directly against the live API. No auth
 * or API key required.
 */
export async function getTradeValues(params: TradeValueParams): Promise<FantasyCalcValue[]> {
  const query = new URLSearchParams({
    isDynasty: String(params.isDynasty),
    numQbs: String(params.numQbs),
    numTeams: String(params.numTeams),
    ppr: String(params.ppr),
  });
  const res = await fetch(`${BASE}/values/current?${query}`);
  if (!res.ok) {
    throw new Error(`FantasyCalc API failed: ${res.status}`);
  }
  return res.json() as Promise<FantasyCalcValue[]>;
}
