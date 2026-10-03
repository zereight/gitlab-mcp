import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as url from "node:url";
import { describe, it } from "node:test";
import { isBooleanFlagLiteral, nextBooleanFlagValue } from "../../cli-boolean-flags.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, "load-config-snapshot.ts");

interface BooleanConfigSnapshot {
  USE_OAUTH: boolean;
}

function loadConfig(argv: readonly string[]): BooleanConfigSnapshot {
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      childEnv[key] = value;
    }
  }
  delete childEnv.GITLAB_USE_OAUTH;
  const stdout = execFileSync(process.execPath, ["--import", "tsx/esm", SNAPSHOT_PATH, ...argv], {
    env: childEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return readBooleanConfigSnapshot(JSON.parse(stdout));
}

function readBooleanConfigSnapshot(value: unknown): BooleanConfigSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("config snapshot was not an object");
  }
  if (!("USE_OAUTH" in value) || typeof value.USE_OAUTH !== "boolean") {
    throw new Error("USE_OAUTH missing");
  }
  return {
    USE_OAUTH: value.USE_OAUTH,
  };
}

describe("When nextBooleanFlagValue reads the following token", () => {
  describe("with a positional command", () => {
    it("should treat the flag as true and leave the command", () => {
      assert.deepEqual(nextBooleanFlagValue("mr"), { value: "true", consumeNext: false });
    });
  });

  describe("with an explicit false", () => {
    it("should consume the literal", () => {
      assert.deepEqual(nextBooleanFlagValue("false"), { value: "false", consumeNext: true });
    });
  });

  describe("with a missing token", () => {
    it("should default to true", () => {
      assert.deepEqual(nextBooleanFlagValue(undefined), { value: "true", consumeNext: false });
    });
  });
});

describe("When isBooleanFlagLiteral inspects a token", () => {
  describe("with true", () => {
    it("should accept it", () => {
      assert.equal(isBooleanFlagLiteral("true"), true);
    });
  });

  describe("with a command name", () => {
    it("should reject it", () => {
      assert.equal(isBooleanFlagLiteral("mr"), false);
    });
  });
});

describe("When config.ts parses space-separated boolean flags", () => {
  describe("with --use-oauth as the last argument", () => {
    it("should turn oauth on", () => {
      assert.equal(loadConfig(["--use-oauth"]).USE_OAUTH, true);
    });
  });

  describe("with --use-oauth followed by another flag", () => {
    it("should turn oauth on", () => {
      assert.equal(loadConfig(["--use-oauth", "--sse"]).USE_OAUTH, true);
    });
  });

  describe("with an empty --use-oauth= assignment", () => {
    it("should leave oauth off", () => {
      assert.equal(loadConfig(["--use-oauth="]).USE_OAUTH, false);
    });
  });

  describe("with --use-oauth before a command", () => {
    it("should turn oauth on without consuming mr", () => {
      assert.equal(loadConfig(["--use-oauth", "mr", "list"]).USE_OAUTH, true);
    });
  });

  describe("with --use-oauth false", () => {
    it("should keep oauth off", () => {
      const cfg = loadConfig(["--use-oauth", "false"]);
      assert.equal(cfg.USE_OAUTH, false);
    });
  });
});
