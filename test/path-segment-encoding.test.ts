import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

const rawPathSegmentPatterns = [
  "/issues/${issueIid}",
  "/merge_requests/${mergeRequestIid}",
  "/discussions/${discussionId}",
  "/notes/${noteId}",
  "/links/${issueLinkId}",
  "/draft_notes/${draftNoteId}",
  "/versions/${versionId}",
  "/groups/${groupId}",
];

test("GitLab URL path IDs are encoded before interpolation", () => {
  for (const pattern of rawPathSegmentPatterns) {
    assert.equal(source.includes(pattern), false, `${pattern} must use encodeGitLabPathSegment`);
  }
});

test("encoding keeps path traversal payloads inside one URL segment", () => {
  const payload = "1/../../../../admin/ci/variables";
  const url = new URL(
    `https://gitlab.com/api/v4/projects/42/issues/${encodeURIComponent(payload)}/notes`
  );

  assert.equal(
    url.pathname,
    "/api/v4/projects/42/issues/1%2F..%2F..%2F..%2F..%2Fadmin%2Fci%2Fvariables/notes"
  );
});

test("malformed percent-encoded segments can still be encoded", () => {
  assert.equal(encodeURIComponent("bad%zz/path"), "bad%25zz%2Fpath");
});
