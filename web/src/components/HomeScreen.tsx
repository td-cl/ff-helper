import { useEffect, useState } from "react";
import { getLeagueDrafts, getUserByUsername, getUserLeagues } from "../api/sleeper";
import type { SleeperIdentity } from "../hooks/useSleeperIdentity";
import type { SleeperLeague } from "../types";

export interface DraftSession {
  draftId: string;
  myUserId: string;
  myUsername: string;
}

interface Props {
  identity: SleeperIdentity | null;
  hydrated: boolean;
  onIdentityResolved: (userId: string, username: string) => void;
  onClearIdentity: () => void;
  onStart: (session: DraftSession) => void;
  onEditRankings: () => void;
  onOpenDashboard: () => void;
  onOpenLeague: (leagueId: string) => void;
}

const LAUNCHABLE_STATUSES = new Set<SleeperLeague["status"]>(["pre_draft", "drafting"]);

const STATUS_LABELS: Record<SleeperLeague["status"], string> = {
  pre_draft: "Pre-Draft",
  drafting: "Drafting",
  in_season: "In Season",
  complete: "Complete",
};

/** Pulls a bare draft_id out of a pasted Sleeper draft room URL, or passes
 * through a bare ID if that's what was pasted. */
function extractDraftId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/draft\/(?:nfl\/)?(\d+)/);
  return match ? match[1] : trimmed;
}

function IdentityForm({ onResolved }: { onResolved: (userId: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError("Enter your Sleeper username.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await getUserByUsername(username.trim());
      if (!user?.user_id) {
        throw new Error("Username not found on Sleeper.");
      }
      onResolved(user.user_id, user.display_name);
    } catch {
      setError("Couldn't find that Sleeper username. Double-check spelling and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="setup-screen">
      <img src="/favicon.svg" />
      <h1>Scouting Sage</h1>
      <p className="tagline">Live Sleeper draft assistant</p>
      <form onSubmit={handleSubmit}>
        <label>
          Your Sleeper username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. tdcl"
            autoFocus
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Connecting..." : "Continue"}
        </button>
      </form>
    </div>
  );
}

function ManualDraftEntry({ onStart }: { onStart: (session: DraftSession) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [draftInput, setDraftInput] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const draftId = extractDraftId(draftInput);
    if (!draftId) {
      setError("Enter a Sleeper draft ID or draft room URL.");
      return;
    }
    if (!username.trim()) {
      setError("Enter your Sleeper username, so we know which picks are yours.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await getUserByUsername(username.trim());
      if (!user?.user_id) {
        throw new Error("Username not found on Sleeper.");
      }
      onStart({ draftId, myUserId: user.user_id, myUsername: user.display_name });
    } catch {
      setError("Couldn't find that Sleeper username. Double-check spelling and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <button className="link-button" onClick={() => setExpanded(true)}>
        Or start a draft manually
      </button>
    );
  }

  return (
    <form className="manual-draft-entry" onSubmit={handleSubmit}>
      <label>
        Draft ID or draft room URL
        <input
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          placeholder="e.g. 289646328508579840 or https://sleeper.com/draft/nfl/..."
          autoFocus
        />
      </label>
      <label>
        Your Sleeper username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. tdcl"
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Connecting..." : "Start"}
      </button>
    </form>
  );
}

function LeagueCard({
  league,
  launching,
  onLaunch,
  onOpenLeague,
}: {
  league: SleeperLeague;
  launching: boolean;
  onLaunch: (league: SleeperLeague) => void;
  onOpenLeague: (leagueId: string) => void;
}) {
  const canLaunch = LAUNCHABLE_STATUSES.has(league.status);
  return (
    <li className="league-card">
      {league.avatar ? (
        <img
          className="league-avatar"
          src={`https://sleepercdn.com/avatars/thumbs/${league.avatar}`}
          alt=""
        />
      ) : (
        <div className="league-avatar league-avatar-fallback">{league.name.charAt(0)}</div>
      )}
      <div className="league-info">
        <span className="league-name">{league.name}</span>
        <span className={`league-status ${league.status}`}>{STATUS_LABELS[league.status]}</span>
      </div>
      {canLaunch && (
        <button onClick={() => onLaunch(league)} disabled={launching}>
          {launching ? "Loading..." : "Draft Assistant"}
        </button>
      )}
      {league.status === "in_season" && (
        <button onClick={() => onOpenLeague(league.league_id)}>Dashboard</button>
      )}
    </li>
  );
}

function LeagueList({
  userId,
  username,
  onStart,
  onOpenDashboard,
  onOpenLeague,
}: {
  userId: string;
  username: string;
  onStart: (session: DraftSession) => void;
  onOpenDashboard: () => void;
  onOpenLeague: (leagueId: string) => void;
}) {
  const [leagues, setLeagues] = useState<SleeperLeague[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [launchingLeagueId, setLaunchingLeagueId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLeagues(null);
    setError(null);
    getUserLeagues(userId, String(new Date().getFullYear()))
      .then((result) => {
        if (!cancelled) setLeagues(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your leagues from Sleeper. Try reloading.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleLaunch(league: SleeperLeague) {
    setLaunchError(null);
    setLaunchingLeagueId(league.league_id);
    try {
      const drafts = await getLeagueDrafts(league.league_id);
      const draft = drafts.find((d) => d.status === league.status) ?? drafts[0];
      if (!draft) {
        throw new Error("No draft found for this league.");
      }
      onStart({ draftId: draft.draft_id, myUserId: userId, myUsername: username });
    } catch {
      setLaunchError(`Couldn't find a draft for ${league.name}. Try the manual entry below.`);
    } finally {
      setLaunchingLeagueId(null);
    }
  }

  const hasInSeasonLeague = leagues?.some((l) => l.status === "in_season") ?? false;

  return (
    <div className="home-screen">
      <div className="home-header">
        <h1>Scouting Sage</h1>
        <p className="tagline">Playing as {username}</p>
      </div>
      {error && <p className="error-text">{error}</p>}
      {launchError && <p className="error-text">{launchError}</p>}
      {leagues == null && !error && <p className="loading">Loading your leagues...</p>}
      {leagues != null && leagues.length === 0 && (
        <p className="empty-row">No leagues found for this season.</p>
      )}
      {hasInSeasonLeague && (
        <button className="primary-button season-dashboard-button" onClick={onOpenDashboard}>
          🏈 Season Dashboard
        </button>
      )}
      {leagues != null && leagues.length > 0 && (
        <ul className="league-list">
          {leagues.map((league) => (
            <LeagueCard
              key={league.league_id}
              league={league}
              launching={launchingLeagueId === league.league_id}
              onLaunch={handleLaunch}
              onOpenLeague={onOpenLeague}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function HomeScreen({
  identity,
  hydrated,
  onIdentityResolved,
  onClearIdentity,
  onStart,
  onEditRankings,
  onOpenDashboard,
  onOpenLeague,
}: Props) {
  if (!hydrated) {
    return null;
  }

  return (
    <>
      {!identity ? (
        <IdentityForm onResolved={onIdentityResolved} />
      ) : (
        <LeagueList
          userId={identity.userId}
          username={identity.username}
          onStart={onStart}
          onOpenDashboard={onOpenDashboard}
          onOpenLeague={onOpenLeague}
        />
      )}
      <div className="home-footer">
        <ManualDraftEntry onStart={onStart} />
        {identity && (
          <button className="link-button" onClick={onClearIdentity}>
            Switch user
          </button>
        )}
        <button className="link-button rankings-link" onClick={onEditRankings}>
          View / adjust rankings
        </button>
      </div>
    </>
  );
}
