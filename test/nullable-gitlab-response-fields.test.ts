import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GitLabCiLintResultSchema,
  GitLabCompareResultSchema,
  GitLabProtectedBranchAccessLevelSchema,
} from "../schemas.js";

test("role-based protected-branch access levels accept null user_id/group_id", () => {
  // #575: GitLab returns null for role-based levels, not omitted fields
  const parsed = GitLabProtectedBranchAccessLevelSchema.parse({
    access_level: 40,
    access_level_description: "Maintainers",
    user_id: null,
    group_id: null,
  });
  assert.equal(parsed.user_id, null);
  assert.equal(parsed.group_id, null);
});

test("branch compare accepts null commit", () => {
  const parsed = GitLabCompareResultSchema.parse({
    commit: null,
    commits: [],
    diffs: [],
  });
  assert.equal(parsed.commit, null);
});

test("ci lint result accepts null merged_yaml/includes on an invalid config", () => {
  // #638: GitLab nulls both fields whenever the config is invalid — i.e. in
  // exactly the case validate_ci_lint exists to report on.
  const parsed = GitLabCiLintResultSchema.parse({
    valid: false,
    errors: ["image is defined in top-level and `default:` entry"],
    warnings: [],
    merged_yaml: null,
    includes: null,
  });
  assert.equal(parsed.valid, false);
  assert.equal(parsed.merged_yaml, null);
  assert.equal(parsed.includes, null);
  assert.deepEqual(parsed.errors, ["image is defined in top-level and `default:` entry"]);
});
