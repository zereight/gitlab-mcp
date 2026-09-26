import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  appendFilterParam,
  appendFilterParams,
  cleanMutuallyExclusiveIdUsernameOptions,
  dropBlankArrayEntries,
  isBlankFilterValue,
  LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS,
  sanitizeToolArguments,
} from "../../utils/tool-args.js";

describe("When sanitizeToolArguments runs", () => {
  describe("with top-level null optionals", () => {
    test("should omit null and undefined keys for generic tools", () => {
      const result = sanitizeToolArguments("create_draft_note", {
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
        position: null,
        resolve_discussion: undefined,
      });

      assert.deepEqual(result, {
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
      });
    });
  });

  describe("with nested objects", () => {
    test("should not strip nulls inside nested position objects", () => {
      const position = {
        base_sha: "abc",
        head_sha: "def",
        start_sha: "ghi",
        position_type: "text",
        old_line: null,
        new_line: 12,
      };

      const result = sanitizeToolArguments("create_draft_note", {
        project_id: "g/p",
        merge_request_iid: "1",
        body: "note",
        position,
      });

      assert.deepEqual(result.position, position);
    });

    test("should preserve null entries inside execute_graphql variables", () => {
      const variables = { milestoneId: null, title: "x" };

      const result = sanitizeToolArguments("execute_graphql", {
        query: "query { project { id } }",
        variables,
      });

      assert.deepEqual(result.variables, variables);
    });
  });

  describe("with meaningful falsy values", () => {
    test("should preserve false and zero", () => {
      const result = sanitizeToolArguments("update_merge_request_discussion_note", {
        resolved: false,
        straight: false,
        count: 0,
        label: "",
      });

      assert.deepEqual(result, {
        resolved: false,
        straight: false,
        count: 0,
        label: "",
      });
    });
  });

  describe("with create_label", () => {
    test("should preserve explicit null priority", () => {
      const result = sanitizeToolArguments("create_label", {
        project_id: "g/p",
        name: "bug",
        color: "#ff0000",
        priority: null,
      });

      assert.equal(result.priority, null);
    });
  });
});

describe("When cleanMutuallyExclusiveIdUsernameOptions runs", () => {
  describe("with list_issues author filters", () => {
    test("should drop author_id when author_username is also set", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        author_id: "42",
        author_username: "alice",
        state: "opened",
      });

      assert.deepEqual(result, {
        author_username: "alice",
        state: "opened",
      });
    });
  });

  describe("with list_issues assignee filters", () => {
    test("should drop assignee_id when assignee_username is also set", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        assignee_id: "7",
        assignee_username: ["bob"],
      });

      assert.deepEqual(result, {
        assignee_username: ["bob"],
      });
    });

    test("should keep assignee_id when assignee_username is an empty array", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        assignee_id: "7",
        assignee_username: [],
      });

      assert.deepEqual(result, {
        assignee_id: "7",
        assignee_username: [],
      });
    });

    test("should keep assignee_id when assignee_username holds only blank entries", () => {
      // The blank entries are dropped when the query is built, so counting them as a
      // value here would delete the id filter and leave the request unfiltered.
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        assignee_id: "7",
        assignee_username: ["", "   "],
      });

      assert.deepEqual(result, {
        assignee_id: "7",
        assignee_username: ["", "   "],
      });
    });

    test("should drop assignee_id when a username survives the blank entries", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions({
        assignee_id: "7",
        assignee_username: ["", "bob"],
      });

      assert.deepEqual(result, {
        assignee_username: ["", "bob"],
      });
    });

    test("should keep assignee_id when assignee_username is a blank scalar", () => {
      // Boolean(" ") is true, so a whitespace-only scalar used to delete the id and then
      // be dropped by the blank guard, leaving the request with no filter at all.
      for (const blank of ["", " ", "  \t "]) {
        const result = cleanMutuallyExclusiveIdUsernameOptions({
          assignee_id: "7",
          assignee_username: blank,
        });

        assert.deepEqual(
          result,
          { assignee_id: "7", assignee_username: blank },
          `blank scalar ${JSON.stringify(blank)} must not drop the id`
        );
      }
    });
  });

  describe("with list_merge_requests reviewer filters", () => {
    test("should drop reviewer_id when reviewer_username is also set", () => {
      const result = cleanMutuallyExclusiveIdUsernameOptions(
        {
          reviewer_id: "3",
          reviewer_username: "carol",
        },
        LIST_MERGE_REQUESTS_ID_USERNAME_PAIRS
      );

      assert.deepEqual(result, {
        reviewer_username: "carol",
      });
    });
  });
});

describe("When dropBlankArrayEntries runs", () => {
  test("should drop blank string entries and keep meaningful ones", () => {
    assert.deepEqual(dropBlankArrayEntries(["", "  ", "bug"]), ["bug"]);
    assert.deepEqual(dropBlankArrayEntries(["\t", "alice", ""]), ["alice"]);
  });

  test("should leave non-array values untouched", () => {
    assert.equal(dropBlankArrayEntries("bug"), "bug");
    assert.equal(dropBlankArrayEntries("  "), "  ");
    assert.equal(dropBlankArrayEntries(undefined), undefined);
    assert.equal(dropBlankArrayEntries(false), false);
  });

  test("should keep non-string array entries", () => {
    assert.deepEqual(dropBlankArrayEntries([0, "bug", false]), [0, "bug", false]);
  });
});

describe("When isBlankFilterValue runs", () => {
  test("should treat undefined, blank strings and empty arrays as blank", () => {
    assert.equal(isBlankFilterValue(undefined), true);
    assert.equal(isBlankFilterValue(""), true);
    assert.equal(isBlankFilterValue(" \t\n"), true);
    assert.equal(isBlankFilterValue([]), true);
  });

  test("should keep meaningful values, including false and zero", () => {
    assert.equal(isBlankFilterValue("bug"), false);
    assert.equal(isBlankFilterValue(["bug"]), false);
    assert.equal(isBlankFilterValue(0), false);
    assert.equal(isBlankFilterValue(false), false);
  });
});

describe("When appendFilterParams runs", () => {
  test("should omit blank scalars, blank array entries and empty arrays", () => {
    const searchParams = new URLSearchParams();

    appendFilterParams(searchParams, {
      search: "",
      ref: "  ",
      labels: ["", "bug"],
      iids: [],
      omitted: undefined,
    });

    assert.deepEqual([...searchParams.entries()], [["labels", "bug"]]);
  });

  test("should keep booleans, zero and non-blank values", () => {
    const searchParams = new URLSearchParams();

    appendFilterParams(searchParams, { with_labels_details: false, page: 0, search: "bug" });

    assert.deepEqual([...searchParams.entries()], [
      ["with_labels_details", "false"],
      ["page", "0"],
      ["search", "bug"],
    ]);
  });

  test("should append a single parameter without dropping a meaningful value", () => {
    const searchParams = new URLSearchParams();

    appendFilterParam(searchParams, "filter[environment_scope]", "production");

    assert.deepEqual([...searchParams.entries()], [["filter[environment_scope]", "production"]]);
  });
});
