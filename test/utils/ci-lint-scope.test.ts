import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ciComponentProjectPath,
  ciLintIncludeProjects,
  scopeCiLintResult,
} from "../../utils/ci-lint-scope.js";

describe("When ciComponentProjectPath runs", () => {
  test("should return the project of a component reference", () => {
    assert.equal(
      ciComponentProjectPath("gitlab.com/components/sast/sast@3.0.0"),
      "components/sast"
    );
    assert.equal(ciComponentProjectPath("gitlab.example.com/a/b/c/build@~latest"), "a/b/c");
  });

  test("should return undefined for a reference without a project", () => {
    assert.equal(ciComponentProjectPath("gitlab.com/build@1.0"), undefined);
  });
});

describe("When ciLintIncludeProjects runs", () => {
  test("should list the declaring project and the included project of a file include", () => {
    assert.deepEqual(
      ciLintIncludeProjects({
        type: "file",
        extra: { project: "other/p" },
        context_project: "g/p",
      }),
      ["g/p", "other/p"]
    );
  });

  test("should list only the declaring project for local, template and remote includes", () => {
    for (const type of ["local", "template", "remote"]) {
      assert.deepEqual(ciLintIncludeProjects({ type, context_project: "other/p" }), ["other/p"]);
    }
  });

  test("should return null for an unknown type or missing fields", () => {
    assert.equal(ciLintIncludeProjects({ type: "artifact", context_project: "g/p" }), null);
    assert.equal(ciLintIncludeProjects({ type: "file", context_project: "g/p" }), null);
    assert.equal(ciLintIncludeProjects({ type: "local" }), null);
    assert.equal(ciLintIncludeProjects("local"), null);
  });
});

describe("When scopeCiLintResult runs", () => {
  const base = {
    valid: true,
    errors: [],
    warnings: [],
    merged_yaml: "x: 1\n",
    jobs: [{ name: "x" }],
  };
  const allowOnly = (path: string) => async (candidate: string) => candidate === path;

  test("should keep a result whose includes all come from allowed projects", async () => {
    const result = { ...base, includes: [{ type: "local", context_project: "g/p" }] };
    assert.equal(await scopeCiLintResult(result, allowOnly("g/p")), result);
  });

  test("should drop the expanded configuration when an include is out of scope", async () => {
    const result = {
      ...base,
      includes: [{ type: "file", extra: { project: "o/p" }, context_project: "g/p" }],
    };
    const scoped = await scopeCiLintResult(result, allowOnly("g/p"));
    assert.equal(scoped.merged_yaml, null);
    assert.equal(scoped.includes, null);
    assert.equal("jobs" in scoped, false);
    assert.equal(scoped.valid, true);
    assert.ok("scope_note" in scoped);
  });

  test("should drop the expanded configuration when includes are missing", async () => {
    const scoped = await scopeCiLintResult({ ...base, includes: null }, allowOnly("g/p"));
    assert.equal(scoped.merged_yaml, null);
  });

  test("should leave an invalid result without expanded configuration alone", async () => {
    const result = { valid: false, errors: ["bad"], merged_yaml: null, includes: null };
    assert.equal(await scopeCiLintResult(result, allowOnly("g/p")), result);
  });
});
