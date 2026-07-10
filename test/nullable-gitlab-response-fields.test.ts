import assert from "node:assert/strict";
import { test } from "node:test";
import {
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
