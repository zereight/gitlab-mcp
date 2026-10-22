import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "release.sh");

// release.sh runs the release at top level, so only the function is sourced.
function readFunction(name: string): string {
  const script = fs.readFileSync(RELEASE_SCRIPT, "utf8");
  const match = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n`, "m").exec(script);
  assert.ok(match, `${name}() not found in scripts/release.sh`);
  return match[0];
}

function git(cwd: string, ...args: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=release-test",
      "-c",
      "user.email=release-test@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "tag.gpgsign=false",
      ...args,
    ],
    { cwd, stdio: "ignore" }
  );
}

function commitAndTag(cwd: string, tag: string): void {
  git(cwd, "commit", "--allow-empty", "-q", "-m", tag);
  git(cwd, "tag", tag);
}

describe("release.sh release type", () => {
  const requireReleaseType = readFunction("require_release_type");
  const usage = "Usage: scripts/release.sh [patch|minor|major]";

  function check(...args: string[]) {
    return spawnSync(
      "bash",
      ["-c", `${requireReleaseType}\nrequire_release_type "$@"`, "_", ...args],
      { encoding: "utf8" }
    );
  }

  test("accepts no argument, patch, minor, and major", () => {
    for (const args of [[], ["patch"], ["minor"], ["major"]]) {
      const result = check(...args);
      assert.strictEqual(result.status, 0, `rejected [${args.join(" ")}]: ${result.stdout}`);
    }
  });

  test("rejects other release types with the usage", () => {
    for (const arg of ["", "Minor", "prerelease", "2.4.0", "--dry-run"]) {
      const result = check(arg);
      assert.strictEqual(result.status, 1, `accepted [${arg}]`);
      assert.ok(result.stdout.startsWith(`❌ Unknown release type: ${arg}\n`), result.stdout);
      assert.ok(result.stdout.includes(usage), result.stdout);
    }
  });

  test("rejects more than one argument with the usage", () => {
    for (const args of [
      ["minor", "major"],
      ["patch", "patch"],
    ]) {
      const result = check(...args);
      assert.strictEqual(result.status, 1, `accepted [${args.join(" ")}]`);
      assert.strictEqual(
        result.stdout,
        `❌ Expected at most one argument: patch, minor or major\n   ${usage} (default: patch)\n`
      );
    }
  });

  test("the script stops on a bad release type before its other checks", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "release-type-"));
    try {
      const result = spawnSync("bash", [RELEASE_SCRIPT, "minr"], { cwd, encoding: "utf8" });
      assert.strictEqual(result.status, 1);
      assert.strictEqual(
        result.stdout,
        `❌ Unknown release type: minr\n   ${usage} (default: patch)\n`
      );
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("release.sh get_previous_tag", () => {
  let repo = "";
  const getPreviousTag = readFunction("get_previous_tag");

  function previousTag(currentTag: string): string {
    return execFileSync(
      "bash",
      ["-c", `${getPreviousTag}\nget_previous_tag "$1"`, "_", currentTag],
      {
        cwd: repo,
        encoding: "utf8",
      }
    ).trim();
  }

  before(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "release-tags-"));
    git(repo, "init", "-q");
    commitAndTag(repo, "v1.0.0");
    commitAndTag(repo, "v1.0.1-next.5");
    commitAndTag(repo, "v1.0.1+build.1");
    commitAndTag(repo, "v1.0.1-rc.1");
    commitAndTag(repo, "v1.0.1");
    commitAndTag(repo, "v1.0.1.1");
    commitAndTag(repo, "v1.0.2-rc.1");
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test("skips pre-release and build tags before the current tag", () => {
    assert.strictEqual(previousTag("v1.0.1"), "v1.0.0");
  });

  test("skips non-X.Y.Z tags down from HEAD when no current tag is given", () => {
    assert.strictEqual(previousTag(""), "v1.0.1");
  });
});
