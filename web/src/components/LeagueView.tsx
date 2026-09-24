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
import { computePositionalNeeds, slotSettingsFromRosterPositions } from "../lib/positionalNeed";
import { computeReplacementLevels, valueOverReplacement } from "../lib/replacementValue";
import { buildSlottedRoster } from "../lib/rosterSlots";
import { suggestTrades, type RosterInfo } from "../lib/tradeFinder";
import { RosterCard } from "./RosterCard";
import { TradeSuggestionCard } from "./TradeSuggestionCard";
import { WaiverTargetsTable, type WaiverTarget } from "./WaiverTargetsTable";

interface Props {
  leagueId: string;
  myUserId: string;
  nflState: NflWeekState | null;
  onBack: () => void;
}

type Tab = "roster" | "waivers" | "trending" | "trades";

const TRENDING_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const TOP_N_PER_POSITION = 20;

function countStartingQbs(rosterPositions: string[]): number {
  return rosterPositions.filter((p) => p === "QB" || p === "SUPER_FLEX").length || 1;
}

export function LeagueView({ leagueId, myUserId, nflState, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("roster");
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

  const replacementLevels = useMemo(
    () => (league ? computeReplacementLevels(values, league.roster_positions, league.total_rosters) : new Map()),
    [values, league],
  );

  // Every trending-add player who's actually available in this league,
  // priced and valued - the shared base both the curated Waiver Targets
  // list and the browsable per-position Trending board are built from.
  const availableCandidates: WaiverTarget[] = useMemo(() => {
    return trendingAdds
      .filter((t) => !rosteredIds.has(t.player_id) && values.has(t.player_id))
      .map((t) => {
        const value = values.get(t.player_id)!;
        const bid = suggestBid(value.value, bidHistory, budgetRemaining, budgetTotal);
        const valueAdd = valueOverReplacement(value, replacementLevels);
        return { playerId: t.player_id, value, trendingCount: t.count, bid, valueAdd };
      });
  }, [trendingAdds, rosteredIds, values, bidHistory, budgetRemaining, budgetTotal, replacementLevels]);

  const waiverTargets: WaiverTarget[] = useMemo(
    () =>
      // Ranked by value ABOVE replacement, not raw value - raw points
      // structurally favor whichever position scores the most (QB/K),
      // regardless of how deep that position actually runs.
      [...availableCandidates].sort((a, b) => b.valueAdd - a.valueAdd).slice(0, 25),
    [availableCandidates],
  );

  // A wider browsable board: every trending-add option, grouped by
  // position and ranked by raw trending add-count (Sleeper's own signal)
  // rather than our computed value - a different, complementary view from
  // the curated Waiver Targets list above.
  const trendingByPosition = useMemo(
    () =>
      TRENDING_POSITIONS.map((position) => ({
        position,
        targets: availableCandidates
          .filter((t) => t.value.position === position)
          .sort((a, b) => b.trendingCount - a.trendingCount)
          .slice(0, TOP_N_PER_POSITION),
      })).filter((group) => group.targets.length > 0),
    [availableCandidates],
  );

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

  const slottedRoster = useMemo(() => {
    if (!league || !myRoster) return null;
    return buildSlottedRoster(
      league.roster_positions,
      myRoster.starters ?? [],
      myRoster.players ?? [],
      myRoster.reserve ?? [],
    );
  }, [league, myRoster]);

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
        {nflState && <span className="week-badge">Week {nflState.week}</span>} FAAB remaining: $
        {budgetRemaining} / ${budgetTotal}
        {myRoster && ` · ${myRoster.settings.wins ?? 0}-${myRoster.settings.losses ?? 0}`}
      </p>
      <div className="tab-bar">
        <button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>
          Roster
        </button>
        <button className={tab === "waivers" ? "active" : ""} onClick={() => setTab("waivers")}>
          Waiver Targets
        </button>
        <button className={tab === "trending" ? "active" : ""} onClick={() => setTab("trending")}>
          Trending
        </button>
        <button className={tab === "trades" ? "active" : ""} onClick={() => setTab("trades")}>
          Trades
        </button>
      </div>
      {tab === "waivers" && (
        <div className="panel">
          {valuesLoading && waiverTargets.length === 0 ? (
            <p className="loading">Loading waiver targets...</p>
          ) : (
            <WaiverTargetsTable targets={waiverTargets} week={nflState?.week ?? null} />
          )}
        </div>
      )}
      {tab === "trending" && (
        <div className="panel">
          {valuesLoading && trendingByPosition.length === 0 ? (
            <p className="loading">Loading trending players...</p>
          ) : trendingByPosition.length === 0 ? (
            <p className="empty-row">No trending pickups available in this league right now.</p>
          ) : (
            trendingByPosition.map((group) => (
              <div key={group.position} className="trending-position-group">
                <h2 className="roster-section-header">{group.position}</h2>
                <WaiverTargetsTable targets={group.targets} week={nflState?.week ?? null} />
              </div>
            ))
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
          {valuesLoading && values.size === 0 ? (
            <p className="loading">Loading roster...</p>
          ) : slottedRoster ? (
            <>
              <ul className="roster-card-grid">
                {slottedRoster.starters.map((s, i) => (
                  <RosterCard
                    key={`${s.playerId}-${i}`}
                    playerId={s.playerId}
                    value={values.get(s.playerId)}
                    week={nflState?.week ?? null}
                    slot={s.slot}
                  />
                ))}
              </ul>
              {slottedRoster.bench.length > 0 && (
                <>
                  <h2 className="roster-section-header">Bench</h2>
                  <ul className="roster-card-grid">
                    {slottedRoster.bench.map((id) => (
                      <RosterCard key={id} playerId={id} value={values.get(id)} week={nflState?.week ?? null} />
                    ))}
                  </ul>
                </>
              )}
              {slottedRoster.ir.length > 0 && (
                <>
                  <h2 className="roster-section-header">IR</h2>
                  <ul className="roster-card-grid">
                    {slottedRoster.ir.map((id) => (
                      <RosterCard key={id} playerId={id} value={values.get(id)} week={nflState?.week ?? null} />
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="empty-row">Couldn't find your roster in this league.</p>
          )}
        </div>
      )}
    </div>
  );
}
