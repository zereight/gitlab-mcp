import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  graphqlQueryContainsWriteOperation,
  graphqlQueryContainsDeleteOperation,
} from "../../utils/graphql-query.js";

describe("When graphqlQueryContainsWriteOperation runs", () => {
  describe("with read-only GraphQL documents", () => {
    test("should allow explicit query operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query { project(fullPath: \"g/p\") { id } }"),
        false
      );
    });

    test("should allow shorthand query operations", () => {
      assert.equal(graphqlQueryContainsWriteOperation("{ project { id } }"), false);
    });

    test("should ignore mutation text inside comments", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("# mutation destroy\nquery { project { id } }"),
        false
      );
    });

    test("should ignore mutation text inside string literals", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation('query { search(query: "mutation") { nodes { id } } }'),
        false
      );
    });
  });

  describe("with write GraphQL documents", () => {
    test("should detect mutation operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation(
          'mutation { destroyProject(input: { projectId: "gid://gitlab/Project/1" }) { errors } }'
        ),
        true
      );
    });

    test("should detect subscription operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("subscription { mergeRequestCreated { id } }"),
        true
      );
    });

    test("should detect write operations in multi-operation documents", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query A { a } mutation B { b }"),
        true
      );
    });

    test("should detect semicolon-separated write operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query A { a }; mutation B { b }"),
        true
      );
    });
  });
});

describe("When graphqlQueryContainsDeleteOperation runs", () => {
  describe("with non-delete documents", () => {
    test("should allow plain queries even when they mention delete words", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation("query { project { removeSourceBranchAfterMerge } }"),
        false
      );
    });

    test("should allow non-delete mutations", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          'mutation { issueSetSeverity(input: { severity: HIGH }) { errors } }'
        ),
        false
      );
    });

    test("should not count delete-like argument names inside parentheses", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation { mergeRequestUpdate(input: { removeSourceBranch: true }) { errors } }"
        ),
        false
      );
    });

    test("should not count delete-like fields nested below the mutation root", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation { issueSetLabels(input: {}) { issue { canBeDeleted } } }"
        ),
        false
      );
    });

    test("should ignore delete text inside comments", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation("# issueDelete\nmutation { issueSetLabels { errors } }"),
        false
      );
    });

    test("should ignore delete text inside string literals", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          'mutation { createNote(input: { body: "projectDelete" }) { errors } }'
        ),
        false
      );
    });
  });

  describe("with delete documents", () => {
    test("should detect delete mutation fields", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          'mutation { issueDelete(input: { projectPath: "g/p", iid: "1" }) { errors } }'
        ),
        true
      );
    });

    test("should detect destroy mutation fields", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          'mutation { destroyBoard(input: { id: "gid://gitlab/Board/1" }) { errors } }'
        ),
        true
      );
    });

    test("should detect remove mutation fields", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation("mutation { awardEmojiRemove(input: {}) { errors } }"),
        true
      );
    });

    test("should detect aliased delete mutation fields", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation("mutation { a: issueDelete(input: {}) { errors } }"),
        true
      );
    });

    test("should detect delete mutations in multi-operation documents", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "query A { project { id } } mutation B { labelDelete(input: {}) { errors } }"
        ),
        true
      );
    });

    test("should detect delete mutations with variable definitions", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation DeleteIssue($id: IssueID!) { issueDelete(input: { id: $id }) { errors } }"
        ),
        true
      );
    });

    test("should conservatively block top-level fragment spreads in mutations", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation { ...f } fragment f on Mutation { issueDelete(input: {}) { errors } }"
        ),
        true
      );
    });
  });
});
