/**
 * Unit tests for ConsumedProxyCodeCache — TTL-aware replay prevention.
 *
 * Expectation (CWE-294): consumed hashes remain rejected until the configured
 * code TTL expires; the cache never LRU-evicts early; inserts fail closed when
 * still-valid entries fill capacity.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ConsumedProxyCodeCache,
  PROXY_CODE_CACHE_FULL,
} from "../../stateless/consumed-proxy-code-cache.js";

describe("ConsumedProxyCodeCache", () => {
  test("rejects replay of a committed hash for the full configured TTL", () => {
    let now = 1_000_000;
    const cache = new ConsumedProxyCodeCache(10, () => now);
    const ttlSeconds = 120;

    assert.equal(cache.tryReserve("hash-a", ttlSeconds), true);
    cache.commit("hash-a");

    // Still within TTL — must reject.
    now += (ttlSeconds - 1) * 1000;
    assert.equal(cache.tryReserve("hash-a", ttlSeconds), false);

    // Exactly at expiry boundary — still rejected while expiresAt > now.
    now += 999;
    assert.equal(cache.tryReserve("hash-a", ttlSeconds), false);

    // After TTL — purged; a new reservation is allowed (sealed code itself
    // would also be expired by openStoredTokensCode at this point).
    now += 1;
    assert.equal(cache.tryReserve("hash-a", ttlSeconds), true);
  });

  test("never LRU-evicts a live entry; fails closed when full", () => {
    let now = 5_000_000;
    const maxSize = 3;
    const cache = new ConsumedProxyCodeCache(maxSize, () => now);
    const ttlSeconds = 600;

    assert.equal(cache.tryReserve("h1", ttlSeconds), true);
    cache.commit("h1");
    assert.equal(cache.tryReserve("h2", ttlSeconds), true);
    cache.commit("h2");
    assert.equal(cache.tryReserve("h3", ttlSeconds), true);
    cache.commit("h3");
    assert.equal(cache.size, 3);

    // A fourth insert must fail closed — not silently drop h1.
    assert.throws(() => cache.tryReserve("h4", ttlSeconds), (err: Error) => {
      return err.message === PROXY_CODE_CACHE_FULL;
    });

    // Original consumed hashes are still covered through the TTL window.
    assert.equal(cache.tryReserve("h1", ttlSeconds), false);
    assert.equal(cache.tryReserve("h2", ttlSeconds), false);
    assert.equal(cache.tryReserve("h3", ttlSeconds), false);
    assert.equal(cache.size, 3);
  });

  test("purge of expired entries frees capacity without reopening live replays", () => {
    let now = 9_000_000;
    const cache = new ConsumedProxyCodeCache(2, () => now);

    assert.equal(cache.tryReserve("old", 10), true);
    cache.commit("old");
    assert.equal(cache.tryReserve("live", 600), true);
    cache.commit("live");
    assert.equal(cache.size, 2);

    // Expire only "old" so a new insert can reclaim that slot.
    now += 10_000;
    assert.equal(cache.tryReserve("fresh", 600), true);
    cache.commit("fresh");
    assert.equal(cache.size, 2);

    // Still-valid "live" hash must remain rejected through its TTL.
    assert.equal(cache.tryReserve("live", 600), false);

    // Cache is full of non-expired entries — fail closed, do not LRU-evict.
    assert.throws(() => cache.tryReserve("another", 600), (err: Error) => {
      return err.message === PROXY_CODE_CACHE_FULL;
    });
  });

  test("release drops pending reservation but not committed entries", () => {
    let now = 2_000_000;
    const cache = new ConsumedProxyCodeCache(10, () => now);

    assert.equal(cache.tryReserve("pending", 60), true);
    cache.release("pending");
    assert.equal(cache.size, 0);
    assert.equal(cache.tryReserve("pending", 60), true);

    cache.commit("pending");
    cache.release("pending");
    assert.equal(cache.size, 1);
    assert.equal(cache.tryReserve("pending", 60), false);
  });

  test("pending reservation also blocks concurrent replay attempts", () => {
    const cache = new ConsumedProxyCodeCache(10, () => 3_000_000);
    assert.equal(cache.tryReserve("in-flight", 120), true);
    assert.equal(cache.tryReserve("in-flight", 120), false);
  });
});
