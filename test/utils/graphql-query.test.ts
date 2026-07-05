import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { graphqlQueryContainsWriteOperation } from "../../utils/graphql-query.js";

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
  });
});
