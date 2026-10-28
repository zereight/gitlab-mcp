import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "merge-changelog-fragments.mjs"
);

const SAMPLE_CHANGELOG = `### Changelog

#### Unreleased

##### Fixed

- Existing unreleased fix

#### [v1.0.0](https://github.com/zereight/gitlab-mcp/compare/v0.9.0...v1.0.0)

> 1 January 2026

##### Added

- First release
`;

function givenChangelogRepo(changelog: string, fragments: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-fragments-"));
  const fragmentsDir = path.join(dir, "changelog.d");
  fs.mkdirSync(fragmentsDir);
  fs.writeFileSync(path.join(fragmentsDir, "README.md"), "# Unreleased notes\n");
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), changelog);
  for (const [name, body] of Object.entries(fragments)) {
    fs.writeFileSync(path.join(fragmentsDir, name), body);
  }
  return {
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function runMerge(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
}

describe("When checking changelog fragments", () => {
  describe("with a known group and a list item", () => {
    it("should accept the fragment", () => {
      const repo = givenChangelogRepo(SAMPLE_CHANGELOG, {
        "fix.md": "### Fixed\n\n- `list_issues` no longer sends blank filters.\n",
      });

      try {
        const result = runMerge(repo.dir, ["--check"]);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Checked 1 changelog fragment/);
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("with a placeholder item", () => {
    it("should fail the check", () => {
      const repo = givenChangelogRepo(SAMPLE_CHANGELOG, {
        "fix.md": "### Fixed\n\n- TODO: describe the fix\n",
      });

      try {
        const result = runMerge(repo.dir, ["--check"]);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /placeholder/);
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("with an empty fragment", () => {
    it("should fail without writing CHANGELOG.md", () => {
      const repo = givenChangelogRepo(SAMPLE_CHANGELOG, {
        "empty.md": "### Fixed\n\n",
      });

      try {
        const result = runMerge(repo.dir, ["--check"]);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /add at least one list item/);
        assert.equal(
          fs.readFileSync(path.join(repo.dir, "CHANGELOG.md"), "utf8"),
          SAMPLE_CHANGELOG
        );
      } finally {
        repo.cleanup();
      }
    });
  });
});

describe("When merging changelog fragments during release", () => {
  describe("with a valid fragment and a version", () => {
    it("should insert the version section and delete the fragment", () => {
      const repo = givenChangelogRepo(SAMPLE_CHANGELOG, {
        "fix-blank-filters.md": "### Fixed\n\n- Blank filters are no longer sent.\n",
      });

      try {
        const result = runMerge(repo.dir, [
          "--version",
          "1.1.0",
          "--previous-tag",
          "v1.0.0",
          "--repo-url",
          "https://github.com/zereight/gitlab-mcp",
        ]);
        const changelog = fs.readFileSync(path.join(repo.dir, "CHANGELOG.md"), "utf8");

        assert.equal(result.status, 0, result.stderr);
        assert.equal(
          fs.existsSync(path.join(repo.dir, "changelog.d", "fix-blank-filters.md")),
          false
        );
        assert.equal(fs.existsSync(path.join(repo.dir, "changelog.d", "README.md")), true);
        assert.match(
          changelog,
          /#### \[v1\.1\.0\]\(https:\/\/github.com\/zereight\/gitlab-mcp\/compare\/v1\.0\.0\.\.\.v1\.1\.0\)/
        );
        assert.match(changelog, /Blank filters are no longer sent/);
        assert.match(changelog, /Existing unreleased fix/);
        assert.match(changelog, /#### Unreleased[\s\S]*#### \[v1\.1\.0\][\s\S]*#### \[v1\.0\.0\]/);
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("with no fragments", () => {
    it("should leave CHANGELOG.md unchanged", () => {
      const repo = givenChangelogRepo(SAMPLE_CHANGELOG, {});

      try {
        const result = runMerge(repo.dir, ["--version", "1.1.0", "--previous-tag", "v1.0.0"]);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /No changelog fragments to merge/);
        assert.equal(
          fs.readFileSync(path.join(repo.dir, "CHANGELOG.md"), "utf8"),
          SAMPLE_CHANGELOG
        );
      } finally {
        repo.cleanup();
      }
    });
  });
});
