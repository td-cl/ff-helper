import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "scouting-sage:identity:v1";

export interface SleeperIdentity {
  userId: string;
  username: string;
}

function loadIdentity(): SleeperIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as SleeperIdentity).userId === "string" &&
      typeof (parsed as SleeperIdentity).username === "string"
    ) {
      return parsed as SleeperIdentity;
    }
    return null;
  } catch {
    return null; // private browsing / storage disabled - just skip persistence
  }
}

function saveIdentity(identity: SleeperIdentity | null) {
  try {
    if (identity) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore - identity simply won't persist across reloads
  }
}

/**
 * Persists the Sleeper username/user_id the user identified themselves with,
 * so returning visitors land straight on their league list instead of
 * retyping their username every time.
 */
export function useSleeperIdentity() {
  const [identity, setIdentityState] = useState<SleeperIdentity | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIdentityState(loadIdentity());
    setHydrated(true);
  }, []);

  const setIdentity = useCallback((next: SleeperIdentity) => {
    setIdentityState(next);
    saveIdentity(next);
  }, []);

  const clearIdentity = useCallback(() => {
    setIdentityState(null);
    saveIdentity(null);
  }, []);

  return { identity, hydrated, setIdentity, clearIdentity };
}
