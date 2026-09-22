import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { encodeGitLabPath, encodeGitLabPathSegment } from "../utils/url.js";

const readSource = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const indexSource = readSource("../index.ts");

const rawPathSegmentPatterns = [
  "/issues/${issueIid}",
  "/merge_requests/${mergeRequestIid}",
  "/discussions/${discussionId}",
  "/notes/${noteId}",
  "/links/${issueLinkId}",
  "/draft_notes/${draftNoteId}",
  "/versions/${versionId}",
  "/groups/${groupId}",
  "/jobs/${jobId}",
  "/pipelines/${pipelineId}",
  "/milestones/${milestoneId}",
  "/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}",
  "/uploads/${secret}/${filename}",
  "/downloads/${directAssetPath}",
  "/${entity}/${entityIid}",
];

test("GitLab URL path IDs are encoded before interpolation", () => {
  for (const pattern of rawPathSegmentPatterns) {
    assert.equal(
      indexSource.includes(pattern),
      false,
      `${pattern} must use encodeGitLabPathSegment`
    );
  }
});

/**
 * encodeURIComponent() does not validate what it encodes: "../../user" becomes
 * "..%2F..%2Fuser", which a server that decodes the separator turns back into a
 * traversal. Every value that lands in a URL path goes through
 * encodeGitLabPathSegment()/encodeGitLabPath() instead; plain encoding stays only
 * for query-string values, where a "/" is data and not a path separator.
 */
const queryStringEncoders = [
  "?source_branch=${encodeURIComponent(branchName)}",
  "?access_token=${encodeURIComponent(token)}",
];

const serverSources = [
  ["index.ts", "../index.ts"],
  ["downloads/proxy.ts", "../downloads/proxy.ts"],
  ["oauth-proxy.ts", "../oauth-proxy.ts"],
] as const;

for (const [name, relativePath] of serverSources) {
  test(`${name} validates values before they reach a URL path`, () => {
    for (const line of readSource(relativePath).split("\n")) {
      if (!line.includes("encodeURIComponent(")) continue;
      assert.ok(
        queryStringEncoders.some(allowed => line.includes(allowed)),
        `${name} encodes a URL value without validating it: ${line.trim()}`
      );
    }
  });
}

test("plain encoding of a project path would leave the traversal visible", () => {
  // The payload this guard exists for: the old encoder emits the separators, so a
  // server that decodes them routes the request to /api/v4/user.
  const payload = "../../user";
  const legacy = `https://gitlab.com/api/v4/projects/${encodeURIComponent(payload)}`;
  assert.equal(new URL(legacy).pathname, "/api/v4/projects/..%2F..%2Fuser");
});

test("the validated encoder keeps an ordinary project path inside one segment", () => {
  const url = new URL(
    `https://gitlab.com/api/v4/projects/${encodeGitLabPathSegment("group/project")}/issues/${encodeGitLabPathSegment("1")}/notes`
  );

  assert.equal(url.pathname, "/api/v4/projects/group%2Fproject/issues/1/notes");
});

test("path traversal payloads are rejected instead of encoded into one segment", () => {
  // GHSA-7c3w-fxgh-frc7 / #587: an unencoded job_id with ../ escaped to /api/v4/user
  for (const payload of [
    "../../../user",
    "1/../../../../admin/ci/variables",
    "..%2F..%2Fuser",
    "..%252F..%252Fuser",
    "/etc/passwd",
  ]) {
    assert.throws(
      () => encodeGitLabPathSegment(payload),
      /Cannot use value as a GitLab URL path segment/,
      payload
    );
  }
});

test("a slash-separated path cannot start outside its route prefix", () => {
  assert.throws(() => encodeGitLabPath("/etc/passwd"), /Cannot use value as a GitLab URL path/);
  assert.throws(
    () => encodeGitLabPath("1/../../../../admin/ci/variables"),
    /Cannot use value as a GitLab URL path segment/
  );
});

test("a broken escape next to a valid one is rejected, not passed through", () => {
  // A guard cannot inspect a value it fails to decode: "%2E%2E%2F%ZZ" still holds a
  // real escape that may hide a separator, so it must not be forwarded unvalidated.
  assert.throws(
    () => encodeGitLabPathSegment("%2E%2E%2F%ZZ"),
    /Cannot use value as a GitLab URL path segment/
  );
});

test("the artifact path goes through the shared multi-segment validator", () => {
  // getJobArtifactFile() was the last call site that split the path itself. The
  // hand-rolled version kept empty segments, so "a//b" reached the URL as an extra
  // separator instead of being rejected like every other call site.
  assert.ok(
    indexSource.includes("const encodedArtifactPath = encodeGitLabPath(artifactPath);"),
    "artifact paths must go through encodeGitLabPath"
  );
  assert.equal(
    indexSource.includes(".map(segment => encodeGitLabPathSegment(segment))"),
    false,
    "artifact paths must not be split into segments by hand"
  );
});

test("a percent sign that starts no escape stays a literal character", () => {
  // "bad%zz/path" cannot be decoded either, but it holds no escape at all, so the
  // guard sees the entire value and the percent sign is encoded as data. Rejecting
  // it would break every file or branch name containing "%".
  assert.equal(encodeGitLabPathSegment("bad%zz/path"), "bad%25zz%2Fpath");
});
