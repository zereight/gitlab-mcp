import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { GitLabApprovalUser, GitLabDeployment } from "../../schemas.js";
import {
  getUniqueApprovalUsers,
  inferMergeRequestApproved,
  MERGE_REQUEST_DEPLOYMENT_SUMMARY_LIMIT,
  parseApprovalsResponse,
  sortDeploymentsByCreatedAtDesc,
  toMergeRequestDeploymentSummaryRecord,
} from "../../utils/merge-request-summary.js";

function approvalUser(id: string, username: string): GitLabApprovalUser {
  return {
    id,
    username,
    name: username,
    state: "active",
    avatar_url: null,
    web_url: `https://gitlab.example.com/${username}`,
  };
}

function deployment(id: string, createdAt: string): GitLabDeployment {
  return {
    id,
    status: "success",
    sha: "abc123",
    created_at: createdAt,
  };
}

const alice = approvalUser("1", "alice");
const bob = approvalUser("2", "bob");

describe("When the merge request summary limit is read", () => {
  test("should be 10 records", () => {
    assert.equal(MERGE_REQUEST_DEPLOYMENT_SUMMARY_LIMIT, 10);
  });
});

describe("When getUniqueApprovalUsers runs", () => {
  describe("with the same user id twice", () => {
    test("should keep the first entry in input order", () => {
      const aliceAgain = { ...approvalUser("1", "alice"), name: "Alice (second)" };

      assert.deepEqual(getUniqueApprovalUsers([alice, bob, aliceAgain]), [alice, bob]);
    });
  });

  describe("with no users", () => {
    test("should return an empty list", () => {
      assert.deepEqual(getUniqueApprovalUsers([]), []);
    });
  });
});

describe("When inferMergeRequestApproved runs", () => {
  const rule = (approved: boolean | undefined) => ({
    id: "10",
    name: "rule",
    rule_type: "regular",
    approvals_required: 1,
    approved,
  });

  describe("with no rules", () => {
    test("should return null for undefined and an empty list", () => {
      assert.equal(inferMergeRequestApproved(undefined), null);
      assert.equal(inferMergeRequestApproved([]), null);
    });
  });

  describe("with a rule that has no approved flag", () => {
    test("should return null", () => {
      assert.equal(inferMergeRequestApproved([rule(true), rule(undefined)]), null);
    });
  });

  describe("with every rule approved", () => {
    test("should return true", () => {
      assert.equal(inferMergeRequestApproved([rule(true), rule(true)]), true);
    });
  });

  describe("with one rule not approved", () => {
    test("should return false", () => {
      assert.equal(inferMergeRequestApproved([rule(true), rule(false)]), false);
    });
  });
});

describe("When parseApprovalsResponse runs", () => {
  describe("with nested approved_by users from /approvals", () => {
    test("should flatten and dedupe them and set source_endpoint", () => {
      const result = parseApprovalsResponse({
        approved: true,
        user_has_approved: false,
        user_can_approve: true,
        approved_by: [{ user: alice }, { user: bob }, { user: alice }],
      });

      assert.deepEqual(result, {
        approved: true,
        user_has_approved: false,
        user_can_approve: true,
        approved_by: [alice, bob],
        approved_by_usernames: ["alice", "bob"],
        source_endpoint: "approvals",
      });
    });
  });

  describe("without approved_by", () => {
    test("should return empty approver lists", () => {
      const result = parseApprovalsResponse({ approved: false });

      assert.deepEqual(result.approved_by, []);
      assert.deepEqual(result.approved_by_usernames, []);
      assert.equal(result.approved, false);
    });
  });

  describe("with an approver missing required fields", () => {
    test("should throw a schema error", () => {
      assert.throws(() => parseApprovalsResponse({ approved_by: [{ user: { id: 1 } }] }));
    });
  });
});

describe("When sortDeploymentsByCreatedAtDesc runs", () => {
  describe("with parseable dates", () => {
    test("should put the newest first without changing the input", () => {
      const input = [
        deployment("1", "2026-10-01T00:00:00Z"),
        deployment("2", "2026-10-03T00:00:00Z"),
        deployment("3", "2026-10-02T00:00:00Z"),
      ];

      const sorted = sortDeploymentsByCreatedAtDesc(input);

      assert.deepEqual(
        sorted.map(entry => entry.id),
        ["2", "3", "1"]
      );
      assert.deepEqual(
        input.map(entry => entry.id),
        ["1", "2", "3"]
      );
    });
  });

  describe("with a date that does not parse", () => {
    test("should compare created_at as strings, newest first", () => {
      const sorted = sortDeploymentsByCreatedAtDesc([
        deployment("1", "a"),
        deployment("2", "c"),
        deployment("3", "b"),
      ]);

      assert.deepEqual(
        sorted.map(entry => entry.id),
        ["2", "3", "1"]
      );
    });
  });
});

describe("When toMergeRequestDeploymentSummaryRecord runs", () => {
  describe("with environment, deployable, and pipeline", () => {
    test("should keep only the summary fields", () => {
      const record = toMergeRequestDeploymentSummaryRecord({
        ...deployment("7", "2026-10-01T00:00:00Z"),
        iid: "3",
        ref: "main",
        updated_at: "2026-10-01T00:01:00Z",
        finished_at: null,
        web_url: "https://gitlab.example.com/d/7",
        user: { id: "9", username: "alice" },
        environment: {
          id: "5",
          name: "production",
          slug: "production",
          external_url: null,
          state: "available",
          tier: "production",
        },
        deployable: {
          id: "11",
          name: "deploy",
          status: "success",
          stage: "deploy",
          web_url: "https://gitlab.example.com/j/11",
          pipeline: {
            id: "12",
            status: "success",
            ref: "main",
            sha: "abc123",
            web_url: "https://gitlab.example.com/p/12",
          },
        },
      });

      assert.deepEqual(record, {
        id: "7",
        status: "success",
        ref: "main",
        sha: "abc123",
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:01:00Z",
        finished_at: null,
        web_url: "https://gitlab.example.com/d/7",
        environment: {
          id: "5",
          name: "production",
          slug: "production",
          external_url: null,
          state: "available",
          tier: "production",
        },
        deployable: {
          id: "11",
          name: "deploy",
          status: "success",
          stage: "deploy",
          web_url: "https://gitlab.example.com/j/11",
          pipeline: {
            id: "12",
            status: "success",
            ref: "main",
            sha: "abc123",
            web_url: "https://gitlab.example.com/p/12",
          },
        },
      });
    });
  });

  describe("with a null deployable and no environment", () => {
    test("should keep deployable null and leave environment undefined", () => {
      const record = toMergeRequestDeploymentSummaryRecord({
        ...deployment("8", "2026-10-01T00:00:00Z"),
        deployable: null,
      });

      assert.equal(record.deployable, null);
      assert.equal(record.environment, undefined);
    });
  });

  describe("with a deployable but no pipeline", () => {
    test("should leave pipeline undefined", () => {
      const record = toMergeRequestDeploymentSummaryRecord({
        ...deployment("9", "2026-10-01T00:00:00Z"),
        deployable: { id: "13", name: "deploy" },
      });

      assert.equal(record.deployable?.pipeline, undefined);
      assert.equal(record.deployable?.id, "13");
    });
  });
});
