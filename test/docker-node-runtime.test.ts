import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Oldest Node 22 release with the October 2026 security fixes, including the
// Brotli decoder fix. The published Docker image runs this runtime.
const MIN_NODE_22 = [22, 23, 4];

function parse(version: string): number[] {
  return version.split(".").map(Number);
}

function atLeast(version: number[], min: number[]): boolean {
  for (let i = 0; i < min.length; i++) {
    if (version[i] !== min[i]) return version[i] > min[i];
  }
  return true;
}

describe("Docker image Node runtime", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const nodeTags = [...dockerfile.matchAll(/^FROM node:(\d+\.\d+\.\d+)-/gm)].map(m => m[1]);

  it("pins every node base image to an exact version", () => {
    const fromNode = dockerfile.match(/^FROM node:/gm) ?? [];
    assert.ok(nodeTags.length >= 2, "expected builder and release stages");
    assert.equal(nodeTags.length, fromNode.length);
  });

  it("uses a Node release with current security fixes", () => {
    for (const tag of nodeTags) {
      const v = parse(tag);
      if (v[0] === 22) assert.ok(atLeast(v, MIN_NODE_22), `node:${tag} is older than 22.23.4`);
      else assert.ok(v[0] > 22, `node:${tag} is older than the supported 22.x line`);
    }
  });

  it("matches .nvmrc", () => {
    const nvmrc = readFileSync(".nvmrc", "utf8").trim();
    for (const tag of nodeTags) assert.equal(tag, nvmrc);
  });
});
