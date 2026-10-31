import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createUnsupportedWidgetSelections,
  mergeUnsupportedWidgetSelections,
  parseUnsupportedWidgetSelections,
  pruneUnsupportedWidgetSelections,
} from "../../utils/work-item-widget-compat.js";

function parse(message: string) {
  const found = parseUnsupportedWidgetSelections(message);
  assert.ok(found, "expected the message to name unsupported selections");
  return found;
}

const CE_ERROR =
  "GraphQL errors: No such type WorkItemWidgetStatus, so it can't be a fragment condition, " +
  "No such type WorkItemWidgetCustomFields, so it can't be a fragment condition, " +
  "No such type WorkItemWidgetWeight, so it can't be a fragment condition, " +
  "No such type WorkItemWidgetHealthStatus, so it can't be a fragment condition, " +
  "Field 'blocked' doesn't exist on type 'WorkItemWidgetLinkedItems'";

const QUERY = `query($path: ID!, $iid: String!) {
      namespace(fullPath: $path) {
        workItem(iid: $iid) {
          id
          widgets {
            __typename
            ... on WorkItemWidgetStatus { status { id name category color iconName position } }
            ... on WorkItemWidgetCustomFields {
              customFieldValues {
                __typename
                customField { id name fieldType }
                ... on WorkItemNumberFieldValue { value }
                ... on WorkItemSelectFieldValue {
                  selectedOptions { id value }
                }
              }
            }
            ... on WorkItemWidgetLabels { labels { nodes { id title color } } }
            ... on WorkItemWidgetWeight { weight rolledUpWeight rolledUpCompletedWeight }
            ... on WorkItemWidgetLinkedItems {
              blocked blockedByCount blockingCount
              linkedItems { nodes { linkType workItem { id iid title } } }
            }
            ... on WorkItemWidgetDevelopment {
              willAutoCloseByMergeRequest
              relatedBranches { nodes { name } }
              featureFlags(first: 10) { nodes { name active } }
            }
          }
        }
      }
    }`;

describe("When parseUnsupportedWidgetSelections runs", () => {
  test("should collect missing fragment types and missing fields from a GitLab CE error", () => {
    const found = parseUnsupportedWidgetSelections(CE_ERROR);

    assert.ok(found);
    assert.deepEqual([...found.types].sort(), [
      "WorkItemWidgetCustomFields",
      "WorkItemWidgetHealthStatus",
      "WorkItemWidgetStatus",
      "WorkItemWidgetWeight",
    ]);
    assert.deepEqual([...found.fields.keys()], ["WorkItemWidgetLinkedItems"]);
    assert.deepEqual([...(found.fields.get("WorkItemWidgetLinkedItems") ?? [])], ["blocked"]);
  });

  test("should return null for errors that do not name a work item type", () => {
    assert.equal(parseUnsupportedWidgetSelections("GraphQL errors: Not found"), null);
    assert.equal(
      parseUnsupportedWidgetSelections(
        "GraphQL errors: Field 'foo' doesn't exist on type 'Project', No such type Bar, so it can't be a fragment condition"
      ),
      null
    );
  });

  test("should return null for empty messages", () => {
    assert.equal(parseUnsupportedWidgetSelections(""), null);
  });
});

describe("When mergeUnsupportedWidgetSelections runs", () => {
  test("should union types and per-type fields", () => {
    const target = parse(CE_ERROR);
    const more = parse(
      "Field 'blockedByCount' doesn't exist on type 'WorkItemWidgetLinkedItems', " +
        "Field 'featureFlags' doesn't exist on type 'WorkItemWidgetDevelopment', " +
        "No such type WorkItemWidgetIteration, so it can't be a fragment condition"
    );

    mergeUnsupportedWidgetSelections(target, more);

    assert.equal(target.types.size, 5);
    assert.ok(target.types.has("WorkItemWidgetIteration"));
    assert.deepEqual([...(target.fields.get("WorkItemWidgetLinkedItems") ?? [])].sort(), [
      "blocked",
      "blockedByCount",
    ]);
    assert.deepEqual([...(target.fields.get("WorkItemWidgetDevelopment") ?? [])], ["featureFlags"]);
  });
});

describe("When pruneUnsupportedWidgetSelections runs", () => {
  test("should return the same string when nothing is unsupported", () => {
    const pruned = pruneUnsupportedWidgetSelections(QUERY, createUnsupportedWidgetSelections());
    assert.equal(pruned, QUERY);
  });

  test("should remove fragments on missing types, including nested braces and fragments", () => {
    const pruned = pruneUnsupportedWidgetSelections(QUERY, parse(CE_ERROR));

    for (const gone of [
      "WorkItemWidgetStatus",
      "WorkItemWidgetCustomFields",
      "WorkItemNumberFieldValue",
      "WorkItemSelectFieldValue",
      "customFieldValues",
      "WorkItemWidgetWeight",
      "rolledUpWeight",
    ]) {
      assert.equal(pruned.includes(gone), false, `${gone} should be removed`);
    }
    for (const kept of [
      "__typename",
      "... on WorkItemWidgetLabels { labels { nodes { id title color } } }",
      "... on WorkItemWidgetLinkedItems {",
      "linkedItems { nodes { linkType workItem { id iid title } } }",
      "... on WorkItemWidgetDevelopment {",
      "featureFlags(first: 10) { nodes { name active } }",
    ]) {
      assert.ok(pruned.includes(kept), `${kept} should be kept`);
    }
  });

  test("should remove only the named fields from a fragment that still exists", () => {
    const unsupported = parse(
      "Field 'blocked' doesn't exist on type 'WorkItemWidgetLinkedItems', " +
        "Field 'blockedByCount' doesn't exist on type 'WorkItemWidgetLinkedItems', " +
        "Field 'blockingCount' doesn't exist on type 'WorkItemWidgetLinkedItems'"
    );

    const pruned = pruneUnsupportedWidgetSelections(QUERY, unsupported);

    assert.equal(/\bblocked\b/.test(pruned), false);
    assert.equal(pruned.includes("blockedByCount"), false);
    assert.equal(pruned.includes("blockingCount"), false);
    assert.ok(pruned.includes("... on WorkItemWidgetLinkedItems {"));
    assert.ok(pruned.includes("linkedItems { nodes { linkType workItem { id iid title } } }"));
    // Other fragments are untouched.
    assert.ok(pruned.includes("... on WorkItemWidgetStatus { status { id name category color"));
  });

  test("should remove a field together with its arguments and sub-selection", () => {
    const unsupported = parse(
      "Field 'featureFlags' doesn't exist on type 'WorkItemWidgetDevelopment'"
    );

    const pruned = pruneUnsupportedWidgetSelections(QUERY, unsupported);

    assert.equal(pruned.includes("featureFlags"), false);
    assert.equal(pruned.includes("active"), false);
    assert.ok(pruned.includes("willAutoCloseByMergeRequest"));
    assert.ok(pruned.includes("relatedBranches { nodes { name } }"));
  });

  test("should drop a fragment whose every field was removed", () => {
    const unsupported = parse(
      "Field 'weight' doesn't exist on type 'WorkItemWidgetWeight', " +
        "Field 'rolledUpWeight' doesn't exist on type 'WorkItemWidgetWeight', " +
        "Field 'rolledUpCompletedWeight' doesn't exist on type 'WorkItemWidgetWeight'"
    );

    const pruned = pruneUnsupportedWidgetSelections(QUERY, unsupported);

    assert.equal(pruned.includes("WorkItemWidgetWeight"), false);
    assert.equal(/\{\s*\}/.test(pruned), false, "no empty selection set");
  });

  test("should not touch nested fields that share a removed field's name", () => {
    const query = `{ widgets {
      ... on WorkItemWidgetLinkedItems { blocked linkedItems { nodes { blocked } } }
    } }`;
    const unsupported = parse("Field 'blocked' doesn't exist on type 'WorkItemWidgetLinkedItems'");

    const pruned = pruneUnsupportedWidgetSelections(query, unsupported);

    assert.ok(pruned.includes("linkedItems { nodes { blocked } }"));
    assert.equal(/\{\s*blocked\s+linkedItems/.test(pruned), false);
  });

  test("should remove an aliased field by its field name", () => {
    const query = `{ widgets { ... on WorkItemWidgetLinkedItems { isBlocked: blocked linkedItems { nodes { id } } } } }`;
    const unsupported = parse("Field 'blocked' doesn't exist on type 'WorkItemWidgetLinkedItems'");

    const pruned = pruneUnsupportedWidgetSelections(query, unsupported);

    assert.equal(pruned.includes("isBlocked"), false);
    assert.equal(pruned.includes("blocked"), false);
    assert.ok(pruned.includes("linkedItems { nodes { id } }"));
  });

  test("should be idempotent", () => {
    const unsupported = parse(CE_ERROR);
    const once = pruneUnsupportedWidgetSelections(QUERY, unsupported);
    const twice = pruneUnsupportedWidgetSelections(once, unsupported);
    assert.equal(twice, once);
  });

  test("should keep the document balanced", () => {
    const unsupported = parse(
      CE_ERROR +
        ", Field 'blockedByCount' doesn't exist on type 'WorkItemWidgetLinkedItems'" +
        ", Field 'featureFlags' doesn't exist on type 'WorkItemWidgetDevelopment'"
    );

    const pruned = pruneUnsupportedWidgetSelections(QUERY, unsupported);

    const opens = (pruned.match(/\{/g) ?? []).length;
    const closes = (pruned.match(/\}/g) ?? []).length;
    assert.equal(opens, closes);
  });
});
