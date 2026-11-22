import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("manifest.json version", () => {
  it("matches package.json version", () => {
    const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
    const manifestVersion = JSON.parse(readFileSync("manifest.json", "utf8")).version;
    assert.equal(
      manifestVersion,
      packageVersion,
      "manifest.json version must match package.json; scripts/release.sh syncs it on each release"
    );
  });
});
