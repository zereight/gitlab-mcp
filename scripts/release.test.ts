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

// Runs `body` in bash after sourcing the named release.sh functions.
function runFunctions(names: string[], body: string, args: string[] = []) {
  const source = names.map(readFunction).join("");
  return spawnSync("bash", ["-c", `${source}\n${body}`, "_", ...args], { encoding: "utf8" });
}

function callFunction(names: string[], body: string, args: string[] = []): string {
  const result = runFunctions(names, body, args);
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trimEnd();
}

describe("release.sh release branch names", () => {
  test("release_branch_name and release_branch_version round-trip X.Y.Z", () => {
    assert.strictEqual(
      callFunction(["release_branch_name"], 'release_branch_name "$1"', ["2.3.25"]),
      "release/v2.3.25"
    );
    assert.strictEqual(
      callFunction(["release_branch_version"], 'release_branch_version "$1"', ["release/v2.3.25"]),
      "2.3.25"
    );
  });

  test("release_branch_version rejects other branches", () => {
    for (const branch of ["feat/x", "release/2.3.25", "release/v2.3", "release/v2.3.25-rc.1"]) {
      const result = runFunctions(["release_branch_version"], 'release_branch_version "$1"', [
        branch,
      ]);
      assert.strictEqual(result.status, 1, `accepted ${branch}`);
    }
  });
});

describe("release.sh is_release_pr", () => {
  function isReleasePr(pr: object): boolean {
    return runFunctions(["is_release_pr"], 'is_release_pr "$1"', [JSON.stringify(pr)]).status === 0;
  }

  test("matches the release PR by title or by head branch", () => {
    assert.ok(isReleasePr({ title: "chore(release): v2.3.25", head: { ref: "release/v2.3.25" } }));
    assert.ok(isReleasePr({ title: "chore(release): v2.3.25", head: { ref: "other" } }));
    assert.ok(isReleasePr({ title: "Release", head: { ref: "release/v2.3.25" } }));
  });

  test("leaves other PRs in the notes", () => {
    assert.ok(!isReleasePr({ title: "feat: add widget", head: { ref: "feat/widget" } }));
    assert.ok(!isReleasePr({ title: "chore(homebrew): sync formula for release" }));
    assert.ok(!isReleasePr({ title: "chore(release) notes cleanup", head: { ref: "docs/x" } }));
    assert.ok(!isReleasePr({}));
  });
});

describe("release.sh review_approval", () => {
  const head = "1111111111111111111111111111111111111111";
  const old = "2222222222222222222222222222222222222222";

  function approval(reviews: object[], author = "zereight"): string {
    return callFunction(["review_approval"], 'review_approval "$1" "$2" "$3"', [
      JSON.stringify(reviews),
      head,
      author,
    ]);
  }

  const review = (login: string | null, state: string, commit = head) => ({
    user: login === null ? null : { login },
    state,
    commit_id: commit,
  });

  test("an approval of the head SHA by someone other than the author counts", () => {
    assert.strictEqual(
      approval([review("coderabbitai[bot]", "APPROVED")]),
      "approved coderabbitai[bot]"
    );
  });

  test("no reviews, comments only, or an approval of an older SHA do not count", () => {
    assert.strictEqual(approval([]), "none");
    assert.strictEqual(approval([review("coderabbitai[bot]", "COMMENTED")]), "none");
    assert.strictEqual(approval([review("coderabbitai[bot]", "APPROVED", old)]), "none");
    assert.strictEqual(
      approval([
        review("coderabbitai[bot]", "APPROVED", old),
        review("coderabbitai[bot]", "COMMENTED"),
      ]),
      "none"
    );
  });

  test("the author's own review does not count", () => {
    assert.strictEqual(approval([review("zereight", "APPROVED")]), "none");
  });

  test("each reviewer's latest decisive review wins", () => {
    assert.strictEqual(
      approval([review("alice", "APPROVED"), review("alice", "CHANGES_REQUESTED")]),
      "changes_requested alice"
    );
    assert.strictEqual(
      approval([review("alice", "CHANGES_REQUESTED", old), review("alice", "APPROVED")]),
      "approved alice"
    );
    assert.strictEqual(
      approval([review("alice", "APPROVED"), review("alice", "DISMISSED")]),
      "none"
    );
    assert.strictEqual(
      approval([review("alice", "APPROVED"), review("alice", "COMMENTED")]),
      "approved alice"
    );
  });

  test("an open change request from another reviewer blocks the approval", () => {
    assert.strictEqual(
      approval([review("coderabbitai[bot]", "APPROVED"), review("bob", "CHANGES_REQUESTED")]),
      "changes_requested bob"
    );
  });

  test("a deleted reviewer (null user) still counts as a non-author", () => {
    assert.strictEqual(approval([review(null, "APPROVED")]), "approved ghost");
  });
});

describe("release.sh required_checks_state", () => {
  const required = ["test", "code-quality", "Release notes"].join("\n");

  function state(checks: Array<[string, string]>): string {
    return callFunction(["required_checks_state"], 'required_checks_state "$1" "$2"', [
      JSON.stringify(checks.map(([name, bucket]) => ({ name, bucket }))),
      required,
    ]);
  }

  test("passes when every required check passed or was skipped", () => {
    assert.strictEqual(
      state([
        ["test", "pass"],
        ["code-quality", "pass"],
        ["Release notes", "skipping"],
        ["optional", "fail"],
      ]),
      "pass"
    );
  });

  test("a required check that has not reported yet is pending", () => {
    assert.strictEqual(
      state([
        ["test", "pass"],
        ["code-quality", "pending"],
      ]),
      "pending code-quality, Release notes"
    );
  });

  test("a failed or cancelled required check fails", () => {
    assert.strictEqual(
      state([
        ["test", "fail"],
        ["code-quality", "cancel"],
        ["Release notes", "pending"],
      ]),
      "fail test, code-quality"
    );
  });

  test("a cancelled run next to a passing run of the same check passes", () => {
    // changelog.yml cancels the "opened" run when the "labeled" run starts.
    assert.strictEqual(
      state([
        ["test", "pass"],
        ["code-quality", "pass"],
        ["Release notes", "cancel"],
        ["Release notes", "pass"],
      ]),
      "pass"
    );
  });

  test("a re-run that is still in progress keeps the check pending", () => {
    assert.strictEqual(
      state([
        ["test", "fail"],
        ["test", "pending"],
        ["code-quality", "pass"],
        ["Release notes", "cancel"],
        ["Release notes", "pending"],
      ]),
      "pending test, Release notes"
    );
  });

  test("a re-run that passed replaces the failure", () => {
    assert.strictEqual(
      state([
        ["test", "fail"],
        ["test", "pass"],
        ["code-quality", "pass"],
        ["Release notes", "pass"],
      ]),
      "pass"
    );
  });
});

describe("release.sh release_state", () => {
  function releaseState(...args: string[]): string {
    return callFunction(["release_state"], 'release_state "$@"', args);
  }

  test("after a release (tag and GitHub release exist), a rerun goes to the bump checks", () => {
    assert.strictEqual(releaseState("yes", "yes", "yes", "", ""), "bump-after-tag");
  });

  test("a failed GitHub release lookup does not bump or pretend the release exists", () => {
    assert.strictEqual(releaseState("no", "yes", "unknown", "", ""), "unknown-github-release");
    assert.strictEqual(releaseState("yes", "yes", "unknown", "", ""), "unknown-github-release");
  });

  test("an open release PR is resumed instead of bumping again", () => {
    assert.strictEqual(releaseState("yes", "yes", "yes", "", "42"), "resume-open-pr");
    assert.strictEqual(releaseState("no", "no", "unknown", "", "42"), "resume-open-pr");
    // A flaky lookup of the current tag's GitHub release must not block resume.
    assert.strictEqual(releaseState("no", "yes", "unknown", "", "42"), "resume-open-pr");
  });

  test("a merged release PR without a tag is tagged and released", () => {
    assert.strictEqual(releaseState("no", "no", "unknown", "42", ""), "tag-merged-pr");
  });

  test("a local tag that is not on the remote is pushed", () => {
    assert.strictEqual(releaseState("yes", "no", "unknown", "42", ""), "push-local-tag");
    assert.strictEqual(releaseState("yes", "no", "unknown", "", ""), "push-local-tag");
  });

  test("a pushed tag without a GitHub release gets its release", () => {
    assert.strictEqual(releaseState("yes", "yes", "no", "", ""), "create-missing-release");
  });

  test("an untagged version with no release PR bumps", () => {
    assert.strictEqual(releaseState("no", "no", "unknown", "", ""), "bump-untagged");
  });
});

describe("release.sh open_release_prs", () => {
  test("keeps only same-repository release/vX.Y.Z branches", () => {
    const prs = [
      { number: 1, headRefName: "release/v2.3.25", isCrossRepository: false },
      { number: 2, headRefName: "release/v2.3.25", isCrossRepository: true },
      { number: 3, headRefName: "feat/release-notes", isCrossRepository: false },
      { number: 4, headRefName: "release/v2.3", isCrossRepository: false },
    ];
    assert.strictEqual(
      callFunction(["open_release_prs"], 'open_release_prs "$1"', [JSON.stringify(prs)]),
      "1"
    );
  });
});

describe("release.sh PR body and dry-run output", () => {
  test("quote_mentions puts @logins in code spans and leaves e-mail addresses alone", () => {
    const notes = [
      "- @alice (1 PR: #5)",
      "- @dependabot[bot] (2 PRs: #6, #7)",
      "- mail a@b.example",
    ].join("\n");
    assert.strictEqual(
      callFunction(["quote_mentions"], 'quote_mentions "$1"', [notes]),
      ["- `@alice` (1 PR: #5)", "- `@dependabot[bot]` (2 PRs: #6, #7)", "- mail a@b.example"].join(
        "\n"
      )
    );
  });

  test("format_command quotes arguments and hides multi-line ones", () => {
    assert.strictEqual(
      callFunction(["format_command"], 'format_command "$@"', [
        "gh",
        "pr",
        "create",
        "--title",
        "chore(release): v1.0.1",
        "--body",
        "line 1\nline 2",
        "it's",
      ]),
      "gh pr create --title 'chore(release): v1.0.1' --body '<multi-line text, printed above>' 'it'\\''s'"
    );
  });

  test("the script rejects a bad option value before its other checks", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "release-options-"));
    try {
      const result = spawnSync("bash", [RELEASE_SCRIPT], {
        cwd,
        encoding: "utf8",
        env: { ...process.env, RELEASE_CHECKS_TIMEOUT: "45m" },
      });
      assert.strictEqual(result.status, 1);
      assert.strictEqual(
        result.stdout,
        "❌ RELEASE_CHECKS_TIMEOUT must be a whole number of seconds, got: 45m\n"
      );
      const dryRun = spawnSync("bash", [RELEASE_SCRIPT], {
        cwd,
        encoding: "utf8",
        env: { ...process.env, RELEASE_DRY_RUN: "yes" },
      });
      assert.strictEqual(dryRun.status, 1);
      assert.strictEqual(dryRun.stdout, "❌ RELEASE_DRY_RUN must be 0 or 1, got: yes\n");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end runs of release.sh against a temporary repository whose "origin"
// is a local bare repository. gh, npm, and make are stubs; git is wrapped only
// to log its subcommands. The gh stub plays GitHub: it keeps PRs in a JSON
// state file and performs merges into the bare origin.
// ---------------------------------------------------------------------------

const GH_STUB = String.raw`#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const statePath = process.env.GH_STUB_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(["gh"].concat(args)) + "\n");

const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const git = (...a) => execFileSync(process.env.REAL_GIT, a, { encoding: "utf8" }).trim();
const flag = name => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const out = value => process.stdout.write(JSON.stringify(value) + "\n");
const fail = message => {
  process.stderr.write(message + "\n");
  process.exit(1);
};
const pick = (obj, fields) => Object.fromEntries(fields.split(",").map(f => [f, obj[f]]));
const headOf = branch => git("--git-dir", state.origin, "rev-parse", "refs/heads/" + branch);
const url = number => "https://github.com/zereight/gitlab-mcp/pull/" + number;

const [cmd, sub] = args;
if (cmd === "pr" && sub === "list") {
  const wanted = flag("--state").toUpperCase();
  const head = flag("--head");
  const prs = Object.values(state.prs).filter(
    pr => pr.state === wanted && (!head || pr.headRefName === head)
  );
  out(prs.map(pr => pick(pr, flag("--json"))));
} else if (cmd === "pr" && sub === "view") {
  const pr = state.prs[args[2]];
  if (!pr) fail("no pull requests found");
  if (pr.state === "OPEN") pr.headRefOid = headOf(pr.headRefName);
  out(pick(pr, flag("--json")));
} else if (cmd === "pr" && sub === "create") {
  const number = state.nextPr++;
  const branch = flag("--head");
  state.prs[number] = {
    number,
    headRefName: branch,
    headRefOid: headOf(branch),
    title: flag("--title"),
    body: flag("--body"),
    labels: [flag("--label")],
    author: { login: "zereight" },
    state: "OPEN",
    isCrossRepository: false,
    mergeCommit: null,
    mergedAt: null,
  };
  save();
  process.stdout.write(url(number) + "\n");
} else if (cmd === "pr" && sub === "checks") {
  out(state.checks.map(name => ({ name, bucket: "pass" })));
} else if (cmd === "pr" && sub === "merge") {
  const pr = state.prs[args[2]];
  if (flag("--match-head-commit") !== headOf(pr.headRefName)) fail("head moved");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "gh-stub-merge-"));
  git("clone", "-q", state.origin, work);
  git("-C", work, "-c", "user.name=GitHub", "-c", "user.email=noreply@github.com",
    "-c", "commit.gpgsign=false", "merge", "-q", "--no-ff", "-m", flag("--subject"),
    "origin/" + pr.headRefName);
  git("-C", work, "push", "-q", "origin", "HEAD:refs/heads/main");
  pr.state = "MERGED";
  pr.mergeCommit = { oid: git("-C", work, "rev-parse", "HEAD") };
  pr.mergedAt = new Date().toISOString();
  fs.rmSync(work, { recursive: true, force: true });
  save();
} else if (cmd === "api") {
  if (args.some(a => a === "-X" || a === "--method" || a.startsWith("-f") || a.startsWith("--field"))) {
    fail("unexpected gh api write");
  }
  const endpoint = args.slice(1).find(a => !a.startsWith("-"));
  let m;
  if ((m = /\/pulls\/(\d+)\/reviews/.exec(endpoint))) {
    const pr = state.prs[m[1]];
    out(state.approve
      ? [{ user: { login: "coderabbitai[bot]" }, state: "APPROVED", commit_id: headOf(pr.headRefName) }]
      : []);
  } else if ((m = /\/pulls\/(\d+)$/.exec(endpoint))) {
    const pr = state.prs[m[1]];
    if (state.pulls[m[1]]) out(state.pulls[m[1]]);
    else if (pr) out({ number: pr.number, title: pr.title, html_url: url(pr.number),
      user: { login: pr.author.login }, head: { ref: pr.headRefName } });
    else fail("gh: Not Found (HTTP 404)");
  } else if (/\/branches\/main\/protection\/required_status_checks$/.test(endpoint)) {
    out({ contexts: state.checks });
  } else if ((m = /\/releases\/tags\/(.+)$/.exec(endpoint))) {
    if (state.releases.some(r => r.tag === m[1])) out({ tag_name: m[1] });
    else fail("gh: Not Found (HTTP 404)");
  } else {
    fail("unexpected gh api " + endpoint);
  }
} else if (cmd === "release" && sub === "create") {
  try {
    git("--git-dir", state.origin, "rev-parse", "--verify", "refs/tags/" + args[2]);
  } catch {
    fail("tag " + args[2] + " is not on the remote");
  }
  state.releases.push({ tag: args[2], title: flag("--title"), notes: flag("--notes"),
    verifyTag: args.includes("--verify-tag") });
  save();
} else {
  fail("unexpected gh " + args.join(" "));
}
`;

const NPM_STUB = String.raw`#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(["npm"].concat(args)) + "\n");
if (args[0] === "version" && args.includes("--no-git-tag-version")) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const [major, minor, patch] = pkg.version.split(".").map(Number);
  const next = { major: [major + 1, 0, 0], minor: [major, minor + 1, 0], patch: [major, minor, patch + 1] }[args[1]];
  pkg.version = next.join(".");
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  lock.version = pkg.version;
  lock.packages[""].version = pkg.version;
  fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
  process.stdout.write("v" + pkg.version + "\n");
} else if (args[0] === "view") {
  process.stdout.write(args[1].split("@").pop() + "\n");
} else if (args[0] !== "run") {
  process.exit(1);
}
`;

const MAKE_STUB = String.raw`#!/usr/bin/env node
require("fs").appendFileSync(process.env.STUB_LOG, JSON.stringify(["make"].concat(process.argv.slice(2))) + "\n");
`;

// Logs the subcommand only (first argument), then runs the real git.
const GIT_WRAPPER = String.raw`#!/bin/bash
printf '%s\n' "$1" >> "$GIT_LOG"
exec "$REAL_GIT" "$@"
`;

interface GhState {
  origin: string;
  nextPr: number;
  approve: boolean;
  checks: string[];
  prs: Record<string, Record<string, unknown>>;
  pulls: Record<string, Record<string, unknown>>;
  releases: Array<{ tag: string; title: string; notes: string; verifyTag: boolean }>;
}

const REAL_GIT = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
const REQUIRED_CHECKS = ["test", "code-quality", "docs-build", "schema-tests", "Release notes"];

class ReleaseSandbox {
  readonly root = fs.mkdtempSync(path.join(os.tmpdir(), "release-e2e-"));
  readonly origin = path.join(this.root, "origin.git");
  readonly repo = path.join(this.root, "repo");
  readonly bin = path.join(this.root, "bin");
  readonly stubLog = path.join(this.root, "stub.log");
  readonly gitLog = path.join(this.root, "git.log");
  readonly statePath = path.join(this.root, "gh-state.json");

  constructor() {
    fs.mkdirSync(this.bin);
    for (const [name, source] of [
      ["gh", GH_STUB],
      ["npm", NPM_STUB],
      ["make", MAKE_STUB],
      ["git", GIT_WRAPPER],
    ]) {
      fs.writeFileSync(path.join(this.bin, name), source, { mode: 0o755 });
    }
    fs.writeFileSync(this.stubLog, "");
    fs.writeFileSync(this.gitLog, "");

    git(this.root, "init", "-q", "--bare", "-b", "main", this.origin);
    git(this.root, "init", "-q", "-b", "main", this.repo);
    for (const [key, value] of [
      ["user.name", "release-test"],
      ["user.email", "release-test@example.com"],
      ["commit.gpgsign", "false"],
      ["tag.gpgsign", "false"],
    ]) {
      git(this.repo, "config", key, value);
    }
    git(this.repo, "remote", "add", "origin", this.origin);

    const pkg = { name: "@zereight/mcp-gitlab", version: "1.0.0" };
    this.write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
    this.write(
      "package-lock.json",
      `${JSON.stringify({ ...pkg, lockfileVersion: 3, packages: { "": pkg } }, null, 2)}\n`
    );
    this.write(
      "server.json",
      `${JSON.stringify(
        {
          name: "io.github.zereight/gitlab-mcp",
          version: "1.0.0",
          packages: [
            { registryType: "npm", identifier: "@zereight/mcp-gitlab", version: "1.0.0" },
            { registryType: "oci", identifier: "docker.io/zereight050/gitlab-mcp:1.0.0" },
          ],
        },
        null,
        2
      )}\n`
    );
    for (const readme of ["README.md", "README.ko.md", "README.zh-CN.md", "README.pt-BR.md"]) {
      this.write(readme, "Run `npx -y @zereight/mcp-gitlab@0.9.0`.\n");
    }
    this.write("docs/index.md", "Run `npx -y @zereight/mcp-gitlab@0.9.0`.\n");
    this.write("CHANGELOG.md", "### Changelog\n\n#### Unreleased\n");
    this.write("changelog.d/README.md", "# Unreleased notes\n");
    fs.mkdirSync(path.join(this.repo, "scripts"));
    fs.copyFileSync(
      path.join(path.dirname(RELEASE_SCRIPT), "merge-changelog-fragments.mjs"),
      path.join(this.repo, "scripts", "merge-changelog-fragments.mjs")
    );
    git(this.repo, "add", "-A");
    git(this.repo, "commit", "-q", "-m", "chore: initial");
    git(this.repo, "tag", "v1.0.0");

    this.write("changelog.d/feat-widget.md", "### Added\n\n- Widget support.\n");
    git(this.repo, "add", "-A");
    git(this.repo, "commit", "-q", "-m", "feat: add widget (#5)");
    git(this.repo, "push", "-q", "origin", "main", "--tags");
    git(this.repo, "fetch", "-q", "origin");

    this.saveState({
      origin: this.origin,
      nextPr: 42,
      approve: true,
      checks: REQUIRED_CHECKS,
      prs: {},
      pulls: {
        "5": {
          number: 5,
          title: "feat: add widget",
          html_url: "https://github.com/zereight/gitlab-mcp/pull/5",
          user: { login: "alice" },
          head: { ref: "feat/widget" },
        },
      },
      releases: [{ tag: "v1.0.0", title: "v1.0.0", notes: "", verifyTag: true }],
    });
  }

  write(file: string, content: string): void {
    fs.mkdirSync(path.dirname(path.join(this.repo, file)), { recursive: true });
    fs.writeFileSync(path.join(this.repo, file), content);
  }

  state(): GhState {
    return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
  }

  saveState(state: GhState): void {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  updateState(update: (state: GhState) => void): void {
    const state = this.state();
    update(state);
    this.saveState(state);
  }

  release(args: string[], env: Record<string, string> = {}) {
    return spawnSync("bash", [RELEASE_SCRIPT, ...args], {
      cwd: this.repo,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${this.bin}${path.delimiter}${process.env.PATH}`,
        GH_STUB_STATE: this.statePath,
        STUB_LOG: this.stubLog,
        GIT_LOG: this.gitLog,
        REAL_GIT,
        RELEASE_POLL_INTERVAL: "0",
        ...env,
      },
    });
  }

  calls(): string[][] {
    return fs
      .readFileSync(this.stubLog, "utf8")
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  gitSubcommands(): string[] {
    return fs.readFileSync(this.gitLog, "utf8").split("\n").filter(Boolean);
  }

  ghCalls(...prefix: string[]): string[][] {
    return this.calls().filter(
      call => call[0] === "gh" && prefix.every((part, i) => call[i + 1] === part)
    );
  }

  read(cwdOrGitDir: string, ...args: string[]): string {
    return execFileSync(REAL_GIT, args, { cwd: cwdOrGitDir, encoding: "utf8" }).trim();
  }

  originRefs(): string {
    return this.read(this.origin, "for-each-ref", "--format=%(refname) %(objectname)");
  }

  originVersionAt(ref: string): string {
    return JSON.parse(this.read(this.origin, "show", `${ref}:package.json`)).version;
  }

  assertCleanOnMain(): void {
    assert.strictEqual(this.read(this.repo, "branch", "--show-current"), "main");
    assert.strictEqual(this.read(this.repo, "status", "--porcelain"), "");
    assert.strictEqual(this.read(this.repo, "branch", "--list", "release/*"), "");
  }

  cleanup(): void {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}

function output(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout}\n${result.stderr}`;
}

describe("release.sh end to end", () => {
  test("RELEASE_DRY_RUN=1 runs the local steps, prints the remote writes, and changes nothing", () => {
    const sandbox = new ReleaseSandbox();
    try {
      const refsBefore = sandbox.originRefs();
      const headBefore = sandbox.read(sandbox.repo, "rev-parse", "HEAD");

      const result = sandbox.release(["patch"], { RELEASE_DRY_RUN: "1" });
      const stdout = String(result.stdout);
      assert.strictEqual(result.status, 0, output(result));

      // Local steps ran: bump, registry preflight, docs, and the release commit.
      const npm = sandbox.calls().filter(call => call[0] === "npm");
      assert.deepStrictEqual(npm[0], ["npm", "version", "patch", "--no-git-tag-version"]);
      assert.ok(npm.some(call => call.join(" ") === "npm run release:mcp-registry -- --check"));
      assert.ok(sandbox.calls().some(call => call.join(" ") === "make docs"));
      assert.ok(stdout.includes("chore(release): v1.0.1"), stdout);
      assert.ok(
        stdout.includes("- feat: add widget [#5](https://github.com/zereight/gitlab-mcp/pull/5)")
      );

      // The remote writes are printed, not run.
      const planned = (command: string) => `🔎 Dry run, would run: ${command}`;
      assert.ok(
        stdout.includes(
          planned(
            "git push --force-with-lease=refs/heads/release/v1.0.1: origin refs/heads/release/v1.0.1:refs/heads/release/v1.0.1"
          )
        ),
        stdout
      );
      assert.ok(
        stdout.includes(
          planned(
            "gh pr create --base main --head release/v1.0.1 --title 'chore(release): v1.0.1' --label no-changelog --body '<multi-line text, printed above>'"
          )
        ),
        stdout
      );
      assert.match(
        stdout,
        /would run: gh pr merge '<PR>' --merge --admin --match-head-commit [0-9a-f]{40} --subject 'chore\(release\): v1\.0\.1 \(#<PR>\)'/
      );
      assert.ok(stdout.includes(planned("git tag v1.0.1 '<merge commit of #<PR>>'")), stdout);
      assert.ok(stdout.includes(planned("git push origin refs/tags/v1.0.1")), stdout);
      assert.ok(
        stdout.includes(
          planned(
            "gh release create v1.0.1 --title v1.0.1 --notes '<multi-line text, printed above>' --verify-tag"
          )
        ),
        stdout
      );
      assert.ok(stdout.includes("Release PR body:"), stdout);
      assert.ok(stdout.includes("- `@alice` (1 PR: #5)"), stdout);

      // gh was only asked to read; git never pushed; origin is untouched.
      for (const write of [
        ["pr", "create"],
        ["pr", "merge"],
        ["release", "create"],
      ]) {
        assert.deepStrictEqual(sandbox.ghCalls(...write), [], `gh ${write.join(" ")} ran`);
      }
      // The gh stub fails any `gh api` call with a method or field, so every
      // api call that got through was a GET.
      const readOnly = new Set(["pr list", "pr view", "pr checks"]);
      for (const call of sandbox.ghCalls()) {
        assert.ok(
          call[1] === "api" || readOnly.has(call.slice(1, 3).join(" ")),
          `unexpected gh call ${call.join(" ")}`
        );
      }
      assert.ok(!sandbox.gitSubcommands().includes("push"), sandbox.gitSubcommands().join(" "));
      assert.strictEqual(sandbox.originRefs(), refsBefore);

      // The checkout is back where it was.
      sandbox.assertCleanOnMain();
      assert.strictEqual(sandbox.read(sandbox.repo, "rev-parse", "HEAD"), headBefore);
      assert.strictEqual(sandbox.read(sandbox.repo, "tag", "--list", "v1.0.1"), "");
      assert.ok(fs.existsSync(path.join(sandbox.repo, "changelog.d", "feat-widget.md")));
    } finally {
      sandbox.cleanup();
    }
  });

  test("opens the release PR, stops without a review, and a rerun merges, tags, and releases it", () => {
    const sandbox = new ReleaseSandbox();
    try {
      // Run 1: checks pass but no review arrives within the (zero) timeout.
      sandbox.updateState(state => {
        state.approve = false;
      });
      const first = sandbox.release(["patch"], { RELEASE_REVIEW_TIMEOUT: "0" });
      assert.strictEqual(first.status, 1, output(first));
      assert.ok(String(first.stdout).includes("No approving review of"), output(first));
      assert.ok(String(first.stdout).includes("rerun scripts/release.sh to resume"), output(first));

      const created = sandbox.ghCalls("pr", "create");
      assert.strictEqual(created.length, 1);
      assert.ok(created[0].join(" ").includes("--label no-changelog"));
      assert.deepStrictEqual(sandbox.ghCalls("pr", "merge"), []);
      const pr = sandbox.state().prs["42"];
      assert.strictEqual(pr.title, "chore(release): v1.0.1");
      assert.ok(String(pr.body).includes("- `@alice` (1 PR: #5)"), String(pr.body));
      assert.strictEqual(sandbox.originVersionAt("refs/heads/release/v1.0.1"), "1.0.1");
      assert.strictEqual(sandbox.originVersionAt("refs/heads/main"), "1.0.0");
      // A real run that stops keeps the local release branch (it matches the
      // pushed PR head) but leaves the checkout on a clean main.
      assert.strictEqual(sandbox.read(sandbox.repo, "branch", "--show-current"), "main");
      assert.strictEqual(sandbox.read(sandbox.repo, "status", "--porcelain"), "");
      assert.strictEqual(
        sandbox.read(sandbox.repo, "rev-parse", "release/v1.0.1"),
        String(pr.headRefOid)
      );
      assert.strictEqual(
        sandbox.read(sandbox.repo, "rev-parse", "HEAD"),
        sandbox.read(sandbox.repo, "rev-parse", "origin/main")
      );

      // Run 2: the approval is there now; the open PR is resumed, not bumped again.
      sandbox.updateState(state => {
        state.approve = true;
      });
      const second = sandbox.release([]);
      assert.strictEqual(second.status, 0, output(second));
      assert.ok(String(second.stdout).includes("Release PR #42 (release/v1.0.1) is open"));
      assert.strictEqual(
        sandbox.calls().filter(call => call[0] === "npm" && call[1] === "version").length,
        1
      );
      assert.strictEqual(sandbox.ghCalls("pr", "create").length, 1);

      const merges = sandbox.ghCalls("pr", "merge");
      assert.strictEqual(merges.length, 1);
      assert.deepStrictEqual(merges[0], [
        "gh",
        "pr",
        "merge",
        "42",
        "--merge",
        "--admin",
        "--match-head-commit",
        String(pr.headRefOid),
        "--subject",
        "chore(release): v1.0.1 (#42)",
      ]);

      const mergeCommit = sandbox.read(sandbox.origin, "rev-parse", "refs/heads/main");
      assert.strictEqual(
        sandbox.read(sandbox.origin, "rev-parse", "refs/tags/v1.0.1"),
        mergeCommit
      );
      assert.strictEqual(
        sandbox.read(sandbox.origin, "log", "-1", "--format=%P", mergeCommit).split(" ").length,
        2,
        "the tag is on a two-parent merge commit"
      );
      assert.strictEqual(
        sandbox.read(sandbox.origin, "log", "-1", "--format=%s", mergeCommit),
        "chore(release): v1.0.1 (#42)"
      );
      assert.strictEqual(sandbox.originVersionAt("refs/tags/v1.0.1"), "1.0.1");

      const releases = sandbox.state().releases.filter(r => r.tag === "v1.0.1");
      assert.strictEqual(releases.length, 1);
      assert.strictEqual(releases[0].verifyTag, true);
      assert.ok(releases[0].notes.includes("[#5]"), releases[0].notes);
      assert.ok(!releases[0].notes.includes("#42"), releases[0].notes);
      assert.ok(releases[0].notes.includes("- @alice (1 PR: #5)"), releases[0].notes);

      sandbox.assertCleanOnMain();
      assert.strictEqual(sandbox.read(sandbox.repo, "rev-parse", "HEAD"), mergeCommit);
      const changelog = sandbox.read(sandbox.origin, "show", "refs/tags/v1.0.1:CHANGELOG.md");
      assert.ok(changelog.includes("- Widget support."), changelog);

      // Run 3: main is the tagged merge commit, so there is nothing to release.
      const third = sandbox.release([]);
      assert.strictEqual(third.status, 0, output(third));
      assert.ok(
        String(third.stdout).includes(
          "Tag v1.0.1 already exists on remote and HEAD has no new commits."
        ),
        output(third)
      );
      assert.strictEqual(sandbox.ghCalls("pr", "create").length, 1);
      assert.strictEqual(sandbox.ghCalls("release", "create").length, 1);
    } finally {
      sandbox.cleanup();
    }
  });

  test("a merged release PR without a tag is tagged and released without a bump", () => {
    const sandbox = new ReleaseSandbox();
    try {
      // The state after a run that merged #42 and then stopped before the tag.
      const repo = sandbox.repo;
      git(repo, "switch", "-q", "-c", "release/v1.0.1");
      const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
      sandbox.write("package.json", `${JSON.stringify({ ...pkg, version: "1.0.1" }, null, 2)}\n`);
      git(repo, "commit", "-q", "-am", "chore(release): v1.0.1");
      git(repo, "switch", "-q", "main");
      git(repo, "merge", "-q", "--no-ff", "-m", "chore(release): v1.0.1 (#42)", "release/v1.0.1");
      git(repo, "branch", "-q", "-D", "release/v1.0.1");
      git(repo, "push", "-q", "origin", "main");
      git(repo, "fetch", "-q", "origin");
      const mergeCommit = sandbox.read(repo, "rev-parse", "HEAD");
      sandbox.updateState(state => {
        state.prs["42"] = {
          number: 42,
          headRefName: "release/v1.0.1",
          title: "chore(release): v1.0.1",
          author: { login: "zereight" },
          state: "MERGED",
          isCrossRepository: false,
          mergeCommit: { oid: mergeCommit },
          mergedAt: "2026-11-10T23:00:00Z",
        };
      });

      const result = sandbox.release(["patch"]);
      assert.strictEqual(result.status, 0, output(result));
      const stdout = String(result.stdout);
      assert.ok(stdout.includes("ignoring release type patch"), stdout);
      assert.ok(stdout.includes("v1.0.1 merged in #42 but is not tagged"), stdout);
      assert.deepStrictEqual(
        sandbox.calls().filter(call => call[0] === "npm" && call[1] === "version"),
        []
      );
      assert.deepStrictEqual(sandbox.ghCalls("pr", "create"), []);
      assert.deepStrictEqual(sandbox.ghCalls("pr", "merge"), []);

      assert.strictEqual(
        sandbox.read(sandbox.origin, "rev-parse", "refs/tags/v1.0.1"),
        mergeCommit
      );
      const releases = sandbox.state().releases.filter(r => r.tag === "v1.0.1");
      assert.strictEqual(releases.length, 1);
      assert.ok(releases[0].notes.includes("[#5]"), releases[0].notes);
      assert.ok(!releases[0].notes.includes("#42"), releases[0].notes);
      sandbox.assertCleanOnMain();
    } finally {
      sandbox.cleanup();
    }
  });
});
