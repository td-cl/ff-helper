import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getLeagueRosters, getLeagueUsers } from "./api/sleeper";
import { BestAvailableTable } from "./components/BestAvailableTable";
import { CollapsiblePanel } from "./components/CollapsiblePanel";
import { DraftHistoryView } from "./components/DraftHistoryView";
import { DraftStatusBanner } from "./components/DraftStatusBanner";
import { MyRosterPanel } from "./components/MyRosterPanel";
import { NeedIndicator } from "./components/NeedIndicator";
import { PositionalValueWidget } from "./components/PositionalValueWidget";
import { RankingsEditor } from "./components/RankingsEditor";
import { HomeScreen, type DraftSession } from "./components/HomeScreen";
import { LeagueView } from "./components/LeagueView";
import { SeasonDashboard } from "./components/SeasonDashboard";
import { useCustomRankings } from "./hooks/useCustomRankings";
import { useDraftPoller } from "./hooks/useDraftPoller";
import { useNflState } from "./hooks/useNflState";
import { usePlayerPool } from "./hooks/usePlayerPool";
import { useSleeperIdentity } from "./hooks/useSleeperIdentity";
import { computeClock } from "./lib/draftClock";
import { computePositionalNeeds } from "./lib/positionalNeed";
import { computePositionalValue } from "./lib/positionalValue";
import { computeRecommendedIds } from "./lib/recommendations";

type SeasonView = { type: "dashboard" } | { type: "league"; leagueId: string } | null;

function App() {
  const [session, setSession] = useState<DraftSession | null>(null);
  const [showRankings, setShowRankings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [seasonView, setSeasonView] = useState<SeasonView>(null);
  const [slotNames, setSlotNames] = useState<Map<number, string>>(new Map());
  const [mySlot, setMySlot] = useState<number | null>(null);

  const sleeperIdentity = useSleeperIdentity();
  const nflState = useNflState();
  const pool = usePlayerPool();
  const rankings = useCustomRankings(pool.pool);
  const { draft, draftState, error, loading } = useDraftPoller(session?.draftId ?? null);

  // Optional: resolve draft_slot -> display name via the league, when the
  // draft belongs to one. Not required for the core polling loop to work.
  useEffect(() => {
    if (!draft?.league_id || !draft.slot_to_roster_id) {
      setSlotNames(new Map());
      setMySlot(null);
      return;
    }
    let cancelled = false;
    Promise.all([getLeagueUsers(draft.league_id), getLeagueRosters(draft.league_id)])
      .then(([users, rosters]) => {
        if (cancelled) return;
        const nameByUserId = new Map(users.map((u) => [u.user_id, u.display_name]));
        const nameByRosterId = new Map(
          rosters
            .filter((r) => r.owner_id)
            .map((r) => [r.roster_id, nameByUserId.get(r.owner_id!) ?? `Roster ${r.roster_id}`]),
        );
        const bySlot = new Map<number, string>();
        for (const [slot, rosterId] of Object.entries(draft.slot_to_roster_id!)) {
          bySlot.set(Number(slot), nameByRosterId.get(rosterId) ?? `Slot ${slot}`);
        }
        setSlotNames(bySlot);

        const myRoster = rosters.find((r) => r.owner_id === session?.myUserId);
        const mySlotEntry = myRoster
          ? Object.entries(draft.slot_to_roster_id!).find(
              ([, rosterId]) => rosterId === myRoster.roster_id,
            )
          : undefined;
        setMySlot(mySlotEntry ? Number(mySlotEntry[0]) : null);
      })
      .catch(() => {
        // Display names are a nice-to-have; fall back to "Slot N" silently.
      });
    return () => {
      cancelled = true;
    };
  }, [draft?.league_id, draft?.slot_to_roster_id, session?.myUserId]);

  const effectiveById = useMemo(
    () => new Map(rankings.effectivePool.map((p) => [p.sleeper_id, p])),
    [rankings.effectivePool],
  );

  const myPlayers = useMemo(() => {
    if (!session) return [];
    const myIds = draftState.rostersByOwner.get(session.myUserId) ?? [];
    return myIds.map((id) => effectiveById.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  }, [draftState, effectiveById, session]);

  const needs = useMemo(() => {
    if (!draft) return [];
    return computePositionalNeeds(
      draft.settings,
      myPlayers.map((p) => p.position),
    );
  }, [draft, myPlayers]);

  const recommendedIds = useMemo(
    () => computeRecommendedIds(rankings.effectivePool, draftState.draftedIds, needs),
    [rankings.effectivePool, draftState.draftedIds, needs],
  );

  const clock = useMemo(
    () => (draft ? computeClock(draft, draftState.picks.length) : null),
    [draft, draftState.picks.length],
  );

  const positionalValues = useMemo(
    () =>
      session
        ? computePositionalValue(
            draftState.picks,
            draftState.draftedIds,
            rankings.effectivePool,
            session.myUserId,
            mySlot,
            clock?.currentPickNo ?? null,
            clock?.totalSlots ?? null,
          )
        : [],
    [draftState, rankings.effectivePool, session, mySlot, clock],
  );

  if (showRankings) {
    return (
      <RankingsEditor
        pool={rankings.effectivePool}
        loading={pool.loading}
        error={pool.error}
        isCustomized={rankings.isCustomized}
        onMoveTo={rankings.moveTo}
        onReset={rankings.reset}
        onClose={() => setShowRankings(false)}
      />
    );
  }

  if (seasonView && sleeperIdentity.identity) {
    const myUserId = sleeperIdentity.identity.userId;
    if (seasonView.type === "dashboard") {
      return (
        <SeasonDashboard
          myUserId={myUserId}
          nflState={nflState}
          onOpenLeague={(leagueId) => setSeasonView({ type: "league", leagueId })}
          onBack={() => setSeasonView(null)}
        />
      );
    }
    return (
      <LeagueView
        leagueId={seasonView.leagueId}
        myUserId={myUserId}
        nflState={nflState}
        onBack={() => setSeasonView(null)}
      />
    );
  }

  if (!session) {
    return (
      <HomeScreen
        identity={sleeperIdentity.identity}
        hydrated={sleeperIdentity.hydrated}
        onIdentityResolved={(userId, username) => sleeperIdentity.setIdentity({ userId, username })}
        onClearIdentity={sleeperIdentity.clearIdentity}
        onStart={setSession}
        onEditRankings={() => setShowRankings(true)}
        onOpenDashboard={() => setSeasonView({ type: "dashboard" })}
        onOpenLeague={(leagueId) => setSeasonView({ type: "league", leagueId })}
      />
    );
  }

  if (showHistory) {
    return (
      <DraftHistoryView
        picks={draftState.picks}
        effectiveById={effectiveById}
        slotNames={slotNames}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  if (pool.error) {
    return (
      <div className="fatal-error">
        <p>{pool.error}</p>
        <p>
          Run the data-prep scripts (fetch_sleeper_players.py, fetch_fantasypros_ecr.py,
          fetch_id_crosswalk.py, build_player_pool.py) to generate web/public/player_pool.json.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="top-bar">
        <span className="brand">Scouting Sage</span>
        <div className="top-bar-actions">
          <button className="link-button" onClick={() => setShowHistory(true)}>
            Draft History
          </button>
          <button className="link-button" onClick={() => setShowRankings(true)}>
            Edit Rankings
          </button>
        </div>
      </div>
      <DraftStatusBanner
        draft={draft}
        picksMade={draftState.picks.length}
        error={error}
        slotNames={slotNames}
      />
      {(loading || pool.loading) && !draft ? (
        <p className="loading">Loading draft data...</p>
      ) : (
        <div className="board">
          <BestAvailableTable
            pool={rankings.effectivePool}
            draftedIds={draftState.draftedIds}
            recommendedIds={recommendedIds}
            currentPickNo={clock?.currentPickNo ?? null}
            totalSlots={clock?.totalSlots ?? null}
          />
          <div className="sidebar">
            <CollapsiblePanel title="Needs" storageKey="needs" className="need-indicator">
              <NeedIndicator needs={needs} />
            </CollapsiblePanel>
            <CollapsiblePanel
              title="Positional Value"
              storageKey="positional-value"
              className="positional-value"
            >
              <PositionalValueWidget
                values={positionalValues}
                hasPicks={draftState.picks.length > 0}
              />
            </CollapsiblePanel>
            <CollapsiblePanel
              title={`My Roster (${myPlayers.length})`}
              storageKey="my-roster"
              className="my-roster"
            >
              <MyRosterPanel myPlayers={myPlayers} />
            </CollapsiblePanel>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
