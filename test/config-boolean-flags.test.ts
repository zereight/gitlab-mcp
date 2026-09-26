import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as url from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, "config-boolean-flags-snapshot.ts");

function loadReadOnlyMode(argv: readonly string[]): boolean {
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "GITLAB_READ_ONLY_MODE") {
      childEnv[key] = value;
    }
  }
  const stdout = execFileSync(process.execPath, ["--import", "tsx/esm", SNAPSHOT_PATH, ...argv], {
    env: childEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const snapshot: unknown = JSON.parse(stdout);
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !("GITLAB_READ_ONLY_MODE" in snapshot) ||
    typeof snapshot.GITLAB_READ_ONLY_MODE !== "boolean"
  ) {
    throw new Error(`unexpected config snapshot: ${stdout}`);
  }
  return snapshot.GITLAB_READ_ONLY_MODE;
}

describe("When config.ts parses a boolean flag without a value", () => {
  describe("with --read-only as the last argument", () => {
    it("should turn read-only mode on", () => {
      assert.equal(loadReadOnlyMode(["--read-only"]), true);
    });
  });

  describe("with --read-only followed by another flag", () => {
    it("should turn read-only mode on", () => {
      assert.equal(loadReadOnlyMode(["--read-only", "--use-pipeline"]), true);
    });
  });

  describe("with an empty --read-only= assignment", () => {
    it("should leave read-only mode off", () => {
      assert.equal(loadReadOnlyMode(["--read-only="]), false);
    });
  });
});

describe("When config.ts parses a boolean flag with a value", () => {
  describe("with --read-only false", () => {
    it("should leave read-only mode off", () => {
      assert.equal(loadReadOnlyMode(["--read-only", "false"]), false);
    });
  });
});
