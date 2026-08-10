/**
 * Per-pod replay-prevention cache for sealed proxy authorization codes.
 *
 * Unlike an LRU map, entries are retained until their TTL expires — never
 * evicted early. Inserts fail closed when the cache is full of still-valid
 * entries, so a burst of traffic cannot reopen a capture-replay window by
 * pushing a consumed hash out before `storedTtlSeconds` elapses.
 */

export type ProxyCodeCacheEntry = {
  expiresAt: number;
  state: "pending" | "consumed";
};

export const PROXY_CODE_CACHE_FULL = "PROXY_CODE_CACHE_FULL";

export class ConsumedProxyCodeCache {
  private readonly _map = new Map<string, ProxyCodeCacheEntry>();
  private readonly _maxSize: number;
  private readonly _now: () => number;

  constructor(maxSize: number, now: () => number = Date.now) {
    this._maxSize = maxSize;
    this._now = now;
  }

  private purgeExpired(now: number): void {
    for (const [key, entry] of this._map) {
      if (entry.expiresAt <= now) this._map.delete(key);
    }
  }

  /**
   * Atomically reserve a code hash for an in-flight exchange.
   * @returns true if reserved, false if already pending/consumed within TTL.
   * @throws Error with message {@link PROXY_CODE_CACHE_FULL} when the cache
   *   is full of non-expired entries (fail closed).
   */
  tryReserve(key: string, ttlSeconds: number): boolean {
    const now = this._now();
    this.purgeExpired(now);
    const existing = this._map.get(key);
    if (existing && existing.expiresAt > now) {
      return false;
    }
    if (this._map.size >= this._maxSize) {
      throw new Error(PROXY_CODE_CACHE_FULL);
    }
    this._map.set(key, {
      expiresAt: now + Math.max(1, ttlSeconds) * 1000,
      state: "pending",
    });
    return true;
  }

  /** Mark a reserved code as fully consumed (replay rejected until TTL). */
  commit(key: string): void {
    const entry = this._map.get(key);
    if (entry) entry.state = "consumed";
  }

  /** Drop an in-flight reservation so a later legitimate exchange can proceed. */
  release(key: string): void {
    const entry = this._map.get(key);
    if (entry?.state === "pending") this._map.delete(key);
  }

  get size(): number {
    return this._map.size;
  }
}
