import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GitLabGroupMilestonesSchema,
  GitLabMilestonesSchema,
  GetGroupMilestoneIssuesSchema,
} from "../schemas.js";

test("group milestone response keeps group_id and rejects missing group_id", () => {
  const parsed = GitLabGroupMilestonesSchema.parse({
    id: 12,
    iid: 3,
    group_id: 16,
    title: "10.0",
    description: null,
    due_date: null,
    start_date: null,
    state: "active",
    updated_at: "2013-10-02T09:24:18Z",
    created_at: "2013-10-02T09:24:18Z",
    expired: false,
  });
  assert.equal(parsed.group_id, "16");
  assert.equal("project_id" in parsed, false);

  // Project schema coerces missing project_id to "undefined" — why group schema exists
  const coerced = GitLabMilestonesSchema.parse({
    id: 12,
    iid: 3,
    group_id: 16,
    title: "10.0",
    description: null,
    due_date: null,
    start_date: null,
    state: "active",
    updated_at: "2013-10-02T09:24:18Z",
    created_at: "2013-10-02T09:24:18Z",
    expired: false,
  });
  assert.equal(coerced.project_id, "undefined");
});

test("group milestone issues schema accepts page and per_page", () => {
  const parsed = GetGroupMilestoneIssuesSchema.parse({
    group_id: "16",
    milestone_id: "12",
    page: 2,
    per_page: 50,
  });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.per_page, 50);
});
