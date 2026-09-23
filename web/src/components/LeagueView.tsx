import { useMemo, useState } from "react";
import { useLeague } from "../hooks/useLeague";
import { useLeagueRosters } from "../hooks/useLeagueRosters";
import { useLeagueTransactions } from "../hooks/useLeagueTransactions";
import { useLeagueUsers } from "../hooks/useLeagueUsers";
import type { NflWeekState } from "../hooks/useNflState";
import { useSeasonPlayerValues } from "../hooks/useSeasonPlayerValues";
import { useTradeValues } from "../hooks/useTradeValues";
import { useTrendingPlayers } from "../hooks/useTrendingPlayers";
import { buildBidHistory, suggestBid } from "../lib/bidEngine";
import { positionClass } from "../lib/positionColors";
import { computePositionalNeeds, slotSettingsFromRosterPositions } from "../lib/positionalNeed";
import { suggestTrades, type RosterInfo } from "../lib/tradeFinder";
import { TradeSuggestionCard } from "./TradeSuggestionCard";
import { WaiverTargetsTable, type WaiverTarget } from "./WaiverTargetsTable";

interface Props {
  leagueId: string;
  myUserId: string;
  nflState: NflWeekState | null;
  onBack: () => void;
}

type Tab = "waivers" | "trades" | "roster";

function countStartingQbs(rosterPositions: string[]): number {
  return rosterPositions.filter((p) => p === "QB" || p === "SUPER_FLEX").length || 1;
}

export function LeagueView({ leagueId, myUserId, nflState, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("waivers");
  const { league, loading: leagueLoading } = useLeague(leagueId);
  const { data: rosters } = useLeagueRosters(leagueId);
  const { data: users } = useLeagueUsers(leagueId);
  const { data: transactions } = useLeagueTransactions(leagueId, nflState?.week ?? 0);
  const { data: trendingAdds } = useTrendingPlayers("add");
  const { index: values, loading: valuesLoading } = useSeasonPlayerValues(
    nflState?.season ?? league?.season ?? "",
    nflState?.week ?? 1,
    league?.scoring_settings ?? null,
  );

  const ppr = league?.scoring_settings.rec ?? 1;
  const { data: tradeValues } = useTradeValues({
    isDynasty: false,
    numQbs: league ? countStartingQbs(league.roster_positions) : 1,
    numTeams: league?.total_rosters ?? 12,
    ppr,
  });

  const myRoster = rosters.find((r) => r.owner_id === myUserId);

  const nameByRosterId = useMemo(() => {
    const nameByOwnerId = new Map(users.map((u) => [u.user_id, u.display_name]));
    return new Map(
      rosters.map((r) => [r.roster_id, r.owner_id ? (nameByOwnerId.get(r.owner_id) ?? `Roster ${r.roster_id}`) : `Roster ${r.roster_id}`]),
    );
  }, [rosters, users]);

  const rosteredIds = useMemo(() => new Set(rosters.flatMap((r) => r.players ?? [])), [rosters]);

  const bidHistory = useMemo(() => buildBidHistory(transactions, values), [transactions, values]);

  const budgetTotal = league?.settings.waiver_budget ?? 0;
  const budgetUsed = myRoster?.settings.waiver_budget_used ?? 0;
  const budgetRemaining = budgetTotal - budgetUsed;

  const waiverTargets: WaiverTarget[] = useMemo(() => {
    return trendingAdds
      .filter((t) => !rosteredIds.has(t.player_id) && values.has(t.player_id))
      .map((t) => {
        const value = values.get(t.player_id)!;
        const bid = suggestBid(value.value, bidHistory, budgetRemaining, budgetTotal);
        return { playerId: t.player_id, value, trendingCount: t.count, bid };
      })
      .sort((a, b) => b.value.value - a.value.value)
      .slice(0, 25);
  }, [trendingAdds, rosteredIds, values, bidHistory, budgetRemaining, budgetTotal]);

  const myNeeds = useMemo(() => {
    if (!league || !myRoster) return [];
    const myPositions = (myRoster.players ?? [])
      .map((id) => values.get(id)?.position)
      .filter((p): p is string => !!p);
    return computePositionalNeeds(slotSettingsFromRosterPositions(league.roster_positions), myPositions);
  }, [league, myRoster, values]);

  const tradeValuesById = useMemo(
    () => new Map(tradeValues.filter((v) => v.player.sleeperId).map((v) => [v.player.sleeperId as string, v])),
    [tradeValues],
  );

  const tradeSuggestions = useMemo(() => {
    if (!myRoster || tradeValuesById.size === 0) return [];
    const nameById = new Map(Array.from(tradeValuesById.entries()).map(([id, v]) => [id, v.player.name]));
    const leaguemateRosters: RosterInfo[] = rosters
      .filter((r) => r.roster_id !== myRoster.roster_id)
      .map((r) => ({
        rosterId: r.roster_id,
        displayName: nameByRosterId.get(r.roster_id) ?? `Roster ${r.roster_id}`,
        playerIds: r.players ?? [],
      }));
    return suggestTrades(myRoster.players ?? [], leaguemateRosters, tradeValuesById, myNeeds, nameById);
  }, [myRoster, tradeValuesById, rosters, nameByRosterId, myNeeds]);

  if (leagueLoading || !league) {
    return <p className="loading">Loading league...</p>;
  }

  return (
    <div className="league-view">
      <div className="top-bar">
        <span className="brand">Scouting Sage</span>
        <button className="link-button" onClick={onBack}>
          ← Dashboard
        </button>
      </div>
      <h1>{league.name}</h1>
      <p className="dim">
        FAAB remaining: ${budgetRemaining} / ${budgetTotal}
        {myRoster && ` · ${myRoster.settings.wins ?? 0}-${myRoster.settings.losses ?? 0}`}
      </p>
      <div className="tab-bar">
        <button className={tab === "waivers" ? "active" : ""} onClick={() => setTab("waivers")}>
          Waiver Targets
        </button>
        <button className={tab === "trades" ? "active" : ""} onClick={() => setTab("trades")}>
          Trades
        </button>
        <button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>
          Roster
        </button>
      </div>
      {tab === "waivers" && (
        <div className="panel">
          {valuesLoading && waiverTargets.length === 0 ? (
            <p className="loading">Loading waiver targets...</p>
          ) : (
            <WaiverTargetsTable targets={waiverTargets} />
          )}
        </div>
      )}
      {tab === "trades" && (
        <div className="panel">
          {tradeSuggestions.length === 0 ? (
            <p className="empty-row">No balanced trade suggestions found right now.</p>
          ) : (
            <ul className="trade-suggestion-list">
              {tradeSuggestions.map((s, i) => (
                <TradeSuggestionCard
                  key={`${s.withRosterId}-${s.give}-${s.get}-${i}`}
                  suggestion={s}
                  valuesById={tradeValuesById}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === "roster" && (
        <div className="panel">
          {myRoster ? (
            <ul className="league-roster-list">
              {(myRoster.players ?? []).map((id) => {
                const v = values.get(id);
                return (
                  <li key={id}>
                    {v ? (
                      <>
                        <span className={`pos-badge ${positionClass(v.position)}`}>{v.position}</span> {v.name}
                        <span className="dim"> · {v.value.toFixed(1)} pts</span>
                      </>
                    ) : (
                      id
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-row">Couldn't find your roster in this league.</p>
          )}
        </div>
      )}
    </div>
  );
}
