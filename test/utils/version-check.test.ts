import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkForNewVersion, isNewerVersion } from "../../utils/version-check.js";

function fetchReturning(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("When isNewerVersion compares versions", () => {
  test("should detect newer patch, minor, and major versions", () => {
    assert.equal(isNewerVersion("2.1.30", "2.1.29"), true);
    assert.equal(isNewerVersion("2.2.0", "2.1.29"), true);
    assert.equal(isNewerVersion("3.0.0", "2.1.29"), true);
  });

  test("should return false for equal or older versions", () => {
    assert.equal(isNewerVersion("2.1.29", "2.1.29"), false);
    assert.equal(isNewerVersion("2.1.28", "2.1.29"), false);
    assert.equal(isNewerVersion("1.9.9", "2.0.0"), false);
  });

  test("should return false for malformed versions", () => {
    assert.equal(isNewerVersion("unknown", "2.1.29"), false);
    assert.equal(isNewerVersion("2.1.30", "unknown"), false);
  });
});

describe("When checkForNewVersion runs", () => {
  test("should return the latest version when the registry has a newer one", async () => {
    const latest = await checkForNewVersion("2.1.29", fetchReturning(200, { version: "2.1.31" }));
    assert.equal(latest, "2.1.31");
  });

  test("should return null when already on the latest version", async () => {
    const latest = await checkForNewVersion("2.1.31", fetchReturning(200, { version: "2.1.31" }));
    assert.equal(latest, null);
  });

  test("should return null without fetching when current version is unknown", async () => {
    let called = false;
    const spyFetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    assert.equal(await checkForNewVersion("unknown", spyFetch), null);
    assert.equal(called, false);
  });

  test("should return null on registry errors instead of throwing", async () => {
    const failingFetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    assert.equal(await checkForNewVersion("2.1.29", failingFetch), null);
    assert.equal(await checkForNewVersion("2.1.29", fetchReturning(500, {})), null);
  });

  test("should return null when the registry returns a non-release version", async () => {
    const latest = await checkForNewVersion(
      "2.1.29",
      fetchReturning(200, { version: "2.2.0-beta.1" })
    );
    assert.equal(latest, null);
  });
});
