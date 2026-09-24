/**
 * In-memory (module-singleton) TTL cache for live Sleeper/FantasyCalc
 * fetches. Kept in memory rather than localStorage - filtered weekly
 * projection/stat payloads run ~1-2MB, which is fine to refetch once per
 * session but risky to pile into localStorage's much smaller quota.
 * Resets on a full page reload, which naturally re-fetches fresh data.
 */
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T;
  }
  const data = await fetcher();
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}
