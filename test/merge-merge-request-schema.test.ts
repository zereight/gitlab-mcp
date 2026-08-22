import { describe, it } from "node:test";
import assert from "node:assert";
import { GitLabMergeRequestSchema, MergeMergeRequestSchema } from "../schemas.js";

const HEAD_SHA = "e82eb4a098e32c796079ca3915e07487fc4db24c";
const PROJECT_ID = "group/project";
const MERGE_REQUEST_IID = "42";

function mergeArgs(overrides: Record<string, unknown> = {}) {
  return {
    project_id: PROJECT_ID,
    merge_request_iid: MERGE_REQUEST_IID,
    ...overrides,
  };
}

function mergeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "1001",
    iid: MERGE_REQUEST_IID,
    project_id: "123",
    title: "Add milestone exposure",
    description: "Expose MR milestone",
    state: "opened",
    author: {
      id: "1",
      username: "octocat",
      name: "Octo Cat",
      avatar_url: null,
      web_url: "https://gitlab.example.com/octocat",
    },
    assignees: [],
    reviewers: [],
    source_branch: "feature/milestone",
    target_branch: "main",
    web_url: "https://gitlab.example.com/group/project/-/merge_requests/42",
    created_at: "2026-05-07T00:00:00.000Z",
    updated_at: "2026-05-07T00:00:00.000Z",
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
    ...overrides,
  };
}

describe("When parsing merge_merge_request arguments", () => {
  describe("with sha provided", () => {
    it("should keep sha on the parsed object", () => {
      const parsed = MergeMergeRequestSchema.parse(mergeArgs({ sha: HEAD_SHA }));
      assert.strictEqual(parsed.sha, HEAD_SHA);
    });
  });

  describe("with sha omitted", () => {
    it("should parse and leave sha undefined", () => {
      const parsed = MergeMergeRequestSchema.parse(mergeArgs());
      assert.strictEqual(parsed.sha, undefined);
    });
  });

  describe("with an unknown extra field", () => {
    it("should strip the unknown field", () => {
      const parsed = MergeMergeRequestSchema.parse(mergeArgs({ not_a_schema_field: "drop-me" }));
      assert.equal("not_a_schema_field" in parsed, false);
    });
  });
});

describe("When parsing a GitLab merge request response", () => {
  describe("with sha present", () => {
    it("should keep sha instead of stripping it", () => {
      const parsed = GitLabMergeRequestSchema.parse(mergeRequest({ sha: HEAD_SHA }));
      assert.strictEqual(parsed.sha, HEAD_SHA);
    });
  });

  describe("with sha omitted", () => {
    it("should accept the payload", () => {
      const parsed = GitLabMergeRequestSchema.parse(mergeRequest());
      assert.strictEqual(parsed.sha, undefined);
    });
  });
});
