import { useCallback, useEffect, useRef, useState } from "react";
import { getDraft, getDraftPicks } from "../api/sleeper";
import { buildDraftState, type DraftState } from "../state/draftStore";
import type { SleeperDraft } from "../types";

const ACTIVE_POLL_MS = 3000;
const IDLE_POLL_MS = 10000;
const MAX_BACKOFF_MS = 30000;

export interface DraftPollerResult {
  draft: SleeperDraft | null;
  draftState: DraftState;
  error: string | null;
  loading: boolean;
}

/**
 * Polls Sleeper's live draft-picks feed. Each tick re-fetches the full
 * picks list and rebuilds state from scratch (rather than patching
 * incrementally), so keepers/autopicks/traded picks self-correct on the
 * next tick regardless of cause. On a failed poll, the last-good state
 * stays on screen and the poller retries with backoff.
 */
export function useDraftPoller(draftId: string | null): DraftPollerResult {
  const [draft, setDraft] = useState<SleeperDraft | null>(null);
  const [draftState, setDraftState] = useState<DraftState>(() => buildDraftState([]));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const backoffRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (id: string) => {
    try {
      const [draftInfo, picks] = await Promise.all([getDraft(id), getDraftPicks(id)]);
      setDraft(draftInfo);
      setDraftState(buildDraftState(picks));
      setError(null);
      setLoading(false);
      backoffRef.current = 0;

      if (draftInfo.status !== "complete") {
        const interval = draftInfo.status === "drafting" ? ACTIVE_POLL_MS : IDLE_POLL_MS;
        timerRef.current = setTimeout(() => poll(id), interval);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reach Sleeper");
      setLoading(false);
      backoffRef.current = Math.min(
        backoffRef.current ? backoffRef.current * 2 : ACTIVE_POLL_MS,
        MAX_BACKOFF_MS,
      );
      timerRef.current = setTimeout(() => poll(id), backoffRef.current);
    }
  }, []);

  useEffect(() => {
    setDraft(null);
    setDraftState(buildDraftState([]));
    setError(null);
    backoffRef.current = 0;

    if (draftId) {
      setLoading(true);
      poll(draftId);
    } else {
      setLoading(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draftId, poll]);

  return { draft, draftState, error, loading };
}
