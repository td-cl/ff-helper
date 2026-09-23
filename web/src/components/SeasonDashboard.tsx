import { useEffect, useState } from "react";
import { getUserLeagues } from "../api/sleeper";
import { useLeagueRosters } from "../hooks/useLeagueRosters";
import type { NflWeekState } from "../hooks/useNflState";
import { useSeasonPlayerValues } from "../hooks/useSeasonPlayerValues";
import { useTrendingPlayers } from "../hooks/useTrendingPlayers";
import type { SleeperLeague } from "../types";

interface Props {
  myUserId: string;
  nflState: NflWeekState | null;
  onOpenLeague: (leagueId: string) => void;
  onBack: () => void;
}

function LeagueSummaryCard({
  league,
  myUserId,
  nflState,
  onOpen,
}: {
  league: SleeperLeague;
  myUserId: string;
  nflState: NflWeekState | null;
  onOpen: () => void;
}) {
  const { data: rosters, loading: rostersLoading } = useLeagueRosters(league.league_id);
  const { data: trendingAdds } = useTrendingPlayers("add");
  const { index: values } = useSeasonPlayerValues(
    nflState?.season ?? league.season,
    nflState?.week ?? 1,
    league.scoring_settings,
  );

  const myRoster = rosters.find((r) => r.owner_id === myUserId);
  const budgetTotal = league.settings.waiver_budget ?? 0;
  const budgetUsed = myRoster?.settings.waiver_budget_used ?? 0;
  const budgetRemaining = budgetTotal - budgetUsed;

  const rosteredIds = new Set(rosters.flatMap((r) => r.players ?? []));
  const topTargetValue = trendingAdds
    .filter((t) => !rosteredIds.has(t.player_id) && values.has(t.player_id))
    .map((t) => values.get(t.player_id)!)
    .sort((a, b) => b.value - a.value)[0];

  return (
    <li className="league-summary-card">
      <div className="league-summary-header">
        <span className="league-name">{league.name}</span>
        {myRoster && (
          <span className="dim">
            {myRoster.settings.wins ?? 0}-{myRoster.settings.losses ?? 0}
            {myRoster.settings.ties ? `-${myRoster.settings.ties}` : ""}
          </span>
        )}
      </div>
      <div className="league-summary-body">
        <span className="dim">
          FAAB remaining: ${budgetRemaining} / ${budgetTotal}
        </span>
        {!rostersLoading && topTargetValue && (
          <span className="dim">
            Top target: {topTargetValue.name} ({topTargetValue.value.toFixed(1)} pts)
          </span>
        )}
      </div>
      <button className="primary-button" onClick={onOpen}>
        Open League
      </button>
    </li>
  );
}

export function SeasonDashboard({ myUserId, nflState, onOpenLeague, onBack }: Props) {
  const [leagues, setLeagues] = useState<SleeperLeague[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserLeagues(myUserId, String(new Date().getFullYear()))
      .then((result) => {
        if (!cancelled) setLeagues(result.filter((l) => l.status === "in_season"));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your leagues from Sleeper.");
      });
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  return (
    <div className="season-dashboard">
      <div className="top-bar">
        <span className="brand">Scouting Sage</span>
        <button className="link-button" onClick={onBack}>
          ← Home
        </button>
      </div>
      <h1>Season Dashboard</h1>
      {error && <p className="error-text">{error}</p>}
      {leagues == null && !error && <p className="loading">Loading your leagues...</p>}
      {leagues != null && leagues.length === 0 && <p className="empty-row">No in-season leagues found.</p>}
      {leagues != null && leagues.length > 0 && (
        <ul className="league-summary-list">
          {leagues.map((league) => (
            <LeagueSummaryCard
              key={league.league_id}
              league={league}
              myUserId={myUserId}
              nflState={nflState}
              onOpen={() => onOpenLeague(league.league_id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
