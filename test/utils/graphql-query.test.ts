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

    test("should ignore escaped triple quotes inside block strings", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation(
          'query { project(fullPath: """contains \\""" not a mutation""") { id } }'
        ),
        false
      );
    });

    test("should not treat subscription field names as write operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query { project { id }, subscription { count } }"),
        false
      );
    });

    test("should allow query with operation name 'mutation'", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query mutation { project { id } }"),
        false
      );
    });

    test("should allow query with operation name 'subscription'", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query subscription { project { id } }"),
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

    test("should detect comma-prefixed write operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation(
          ",mutation { destroyProject(input: { projectId: 1 }) { errors } }"
        ),
        true
      );
    });

    test("should detect comma-separated write operations", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query A { a }, mutation B { b }"),
        true
      );
    });

    test("should detect mutations after a comma-separated variable definition list", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query Q ($c: Boolean = true) { a }, mutation { b { id } }"),
        true
      );
    });

    test("should detect mutations after an operation directive", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query Q @dir(x: 1) { a }, mutation { b { id } }"),
        true
      );
    });
  });

  describe("with comma-separated or decorated query headers", () => {
    test("should allow queries with comma-separated variable definitions", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query Q ($c: Boolean = true), { project { id } }"),
        false
      );
    });

    test("should allow queries with a directive on the operation header", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation('query Q @cached(ttl: 60), { project(fullPath: "g/p") { id } }'),
        false
      );
    });

    test("should not treat a mutation-named argument as an operation", () => {
      assert.equal(
        graphqlQueryContainsWriteOperation("query { project(mutation: 1) { id } }"),
        false
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

    test("should detect comma-prefixed delete mutations", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          ', mutation M { issueDelete(input: { iid: "1" }) { id } }'
        ),
        true
      );
    });

    test("should detect comma-prefixed delete mutations without whitespace", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(',mutation{issueDelete(input:{iid:"1"}){id}}'),
        true
      );
    });

    test("should detect delete mutations after a comma-separated query", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "query HealthCheck { x }, mutation M { issueDelete(input: {}) { id } }"
        ),
        true
      );
    });

    test("should allow comma-separated queries", () => {
      assert.equal(graphqlQueryContainsDeleteOperation("query A { a }, query B { b }"), false);
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

  describe("with destructive mutations that are not named delete", () => {
    test("should detect environmentStop", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          'mutation { environmentStop(input: { environmentId: "gid://gitlab/Environment/1" }) { errors } }'
        ),
        true
      );
    });

    test("should detect pipelineCancel", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation("mutation { pipelineCancel(input: {}) { errors } }"),
        true
      );
    });

    test("should detect clusterAgentTokenRevoke", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation { clusterAgentTokenRevoke(input: {}) { errors } }"
        ),
        true
      );
    });

    test("should detect jobUnschedule", () => {
      // GitLab moves the scheduled job to manual and clears its scheduled state, so it
      // is a teardown action even though no teardown verb is part of its name.
      assert.equal(
        graphqlQueryContainsDeleteOperation("mutation { jobUnschedule(input: {}) { errors } }"),
        true
      );
    });

    test("should detect aliased destructive mutations", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation { s: environmentStop(input: {}) { errors } }"
        ),
        true
      );
    });

    test("should not treat an alias as a destructive mutation field", () => {
      for (const query of [
        "mutation { stop: issueSetSeverity(input: {}) { errors } }",
        "mutation { revoke: issueSetSeverity(input: {}) { errors } }",
        "mutation { terminate: updateIssue(input: {}) { issue { id } } }",
      ]) {
        assert.equal(graphqlQueryContainsDeleteOperation(query), false, query);
      }
    });

    test("should not treat a spaced or comma-separated alias as a destructive field", () => {
      for (const query of [
        "mutation { stop : issueSetSeverity(input: {}) { errors } }",
        "mutation { revoke,: issueSetSeverity(input: {}) { errors } }",
        "mutation { terminate\n: updateIssue(input: {}) { issue { id } } }",
      ]) {
        assert.equal(graphqlQueryContainsDeleteOperation(query), false, query);
      }
    });

    test("should still detect a destructive field after a spaced alias", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "mutation { harmless : environmentStop(input: {}) { errors } }"
        ),
        true
      );
    });

    test("should still detect a destructive field hidden behind a harmless alias", () => {
      for (const query of [
        "mutation { harmless: environmentStop(input: {}) { errors } }",
        "mutation { step: pipelineCancel(input: {}) { errors } }",
      ]) {
        assert.equal(graphqlQueryContainsDeleteOperation(query), true, query);
      }
    });

    test("should detect destructive mutations in multi-operation documents", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          "query A { project { id } } mutation B { environmentStop(input: {}) { errors } }"
        ),
        true
      );
    });

    test("should still allow mutations without a destructive verb", () => {
      for (const query of [
        "mutation { issueMove(input: {}) { errors } }",
        "mutation { mergeRequestMerge(input: {}) { errors } }",
        "mutation { todoMarkDone(input: {}) { errors } }",
      ]) {
        assert.equal(graphqlQueryContainsDeleteOperation(query), false, query);
      }
    });
  });

  describe("with commas, directives or comments in the mutation header", () => {
    // SAFE_FIELD is harmless, but its alias `mutation` is the decoy the old header regex
    // latched onto. DESTRUCTIVE_TAIL is the real field that must not be missed.
    const SAFE_FIELD =
      'issueSetConfidential(input: {projectPath: "g/p", iid: "1", confidential: $c}) { errors }';
    const DESTRUCTIVE_TAIL = 'environmentStop(input: {id: "gid://gitlab/Environment/1"}) { errors }';

    test("should detect the reported comma-after-variables payload", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          'mutation ($c: Boolean = true), { a: issueSetConfidential(input: {projectPath: "g/p", iid: "1", confidential: $c}) { errors }, mutation: issueSetConfidential(input: {projectPath: "g/p", iid: "1", confidential: $c}) { errors } environmentStop(input: {id: "gid://gitlab/Environment/1"}) { errors } }'
        ),
        true
      );
    });

    test("should detect a destructive field behind a decoy alias in any header position", () => {
      for (const header of [
        "mutation M ($c: Boolean = true), ",
        "mutation M, ($c: Boolean = true) ",
        "mutation ,, M , ($c: Boolean = true) ,",
        "mutation ($c: Boolean = true) @dir ",
        "mutation ($c: Boolean = true) @dir(x: {a: [1]}), ",
        "mutation M ($c: Boolean = true) @dir(x: 1), ",
        "mutation #note\n($c: Boolean = true) #note\n",
        "mutation M ($c: Boolean = true) ",
      ]) {
        const query = `${header}{ a: ${SAFE_FIELD}, mutation: ${SAFE_FIELD} ${DESTRUCTIVE_TAIL} }`;
        assert.equal(graphqlQueryContainsDeleteOperation(query), true, query);
      }
    });

    test("should detect a destructive field behind a decoy alias with no comma", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          `mutation { mutation: ${SAFE_FIELD} ${DESTRUCTIVE_TAIL} }`
        ),
        true
      );
    });

    test("should detect a destructive field after an argument named mutation", () => {
      assert.equal(
        graphqlQueryContainsDeleteOperation(
          `mutation { x(a: 1, mutation: 2) { ok } ${DESTRUCTIVE_TAIL} }`
        ),
        true
      );
    });

    test("should block headers that cannot be parsed", () => {
      for (const query of [
        "mutation ($c: Boolean = true",
        "mutation M, ($c: Boolean = true) { issueSetSeverity(input: {}) { errors } ",
        "mutation M, ($c: Boolean = true) { }",
        "mutation M, ($c: Boolean = true) { issueSetSeverity(input: {}) { errors } } }",
      ]) {
        assert.equal(graphqlQueryContainsDeleteOperation(query), true, query);
      }
    });

    test("should allow non-destructive mutations with commas, directives or comments in the header", () => {
      for (const query of [
        `mutation ($c: Boolean = true), { a: ${SAFE_FIELD}, b: ${SAFE_FIELD} }`,
        "mutation M, ($c: Boolean = true) { issueSetSeverity(input: {}) { errors } }",
        "mutation ($i: Input = {a: 1}) @dir(x: [1]) { issueSetSeverity(input: {}) { errors } }",
        "mutation #note\n($i: Input = {a: 1}) #note\n{ issueSetSeverity(input: {}) { errors } }",
      ]) {
        assert.equal(graphqlQueryContainsDeleteOperation(query), false, query);
      }
    });
  });
});
