import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "release.sh");

// release.sh runs the release at top level, so only the function is sourced.
function readGetPreviousTag(): string {
  const script = fs.readFileSync(RELEASE_SCRIPT, "utf8");
  const match = /^get_previous_tag\(\) \{\n[\s\S]*?\n\}\n/m.exec(script);
  assert.ok(match, "get_previous_tag() not found in scripts/release.sh");
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

describe("release.sh get_previous_tag", () => {
  let repo = "";
  const getPreviousTag = readGetPreviousTag();

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
