import assert from "node:assert/strict";
import http from "node:http";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const ALLOWED_PROJECT_ID = "123";
const ALLOWED_PROJECT_PATH = "group/allowed";
const DENIED_PROJECT_ID = "999";
const DENIED_MESSAGE = `Access denied: Project ${DENIED_PROJECT_ID} is not in the allowed project list: ${ALLOWED_PROJECT_ID}`;

const WORK_ITEM_IID = 1;
const WORK_ITEM_GID = "gid://gitlab/WorkItem/501";
const OWN_NOTE_GID = "gid://gitlab/Note/7001";
const FOREIGN_ISSUE_NOTE_GID = "gid://gitlab/Note/9001";
const MERGE_REQUEST_NOTE_GID = "gid://gitlab/Note/9002";
const MISSING_NOTE_GID = "gid://gitlab/Note/9404";

// GitLab.com returns Note.noteableId as the noteable's bare numeric id.
const NOTES: Record<string, { id: string; noteableId: number; noteableType: string }> = {
  [OWN_NOTE_GID]: { id: OWN_NOTE_GID, noteableId: 501, noteableType: "Issue" },
  [FOREIGN_ISSUE_NOTE_GID]: { id: FOREIGN_ISSUE_NOTE_GID, noteableId: 888, noteableType: "Issue" },
  // Same numeric id as the work item, but a different noteable type.
  [MERGE_REQUEST_NOTE_GID]: {
    id: MERGE_REQUEST_NOTE_GID,
    noteableId: 501,
    noteableType: "MergeRequest",
  },
};

function noteDeniedMessage(noteId: string): string {
  return `Access denied: Note ${noteId} was not found on work item #${WORK_ITEM_IID} in ${ALLOWED_PROJECT_PATH}`;
}

interface RecordedRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}

interface AllowlistServer {
  client: Client;
  requests: RecordedRequest[];
}

function boundPort(server: http.Server): number {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("mock GitLab server did not bind to a TCP port");
  }
  return address.port;
}

function requestPath(url: string): string {
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function parseBody(raw: string): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function resultText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  assert.ok("content" in result && Array.isArray(result.content), "expected tool content");
  const block = result.content.find(
    (item: unknown): item is { type: "text"; text: string } =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
  );
  assert.ok(block, "expected a text tool result");
  return block.text;
}

function user(id: number) {
  return { id, username: `user${id}`, name: `User ${id}` };
}

function issue(projectId: string, iid: string) {
  return {
    id: Number(projectId) * 1000 + Number(iid),
    iid: Number(iid),
    project_id: Number(projectId),
    title: `Issue ${iid}`,
    description: "",
    state: "opened",
    author: user(1),
    assignees: [],
    labels: [],
    milestone: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    web_url: `http://gitlab.test/${projectId}/-/issues/${iid}`,
  };
}

function mergeRequest(body: Record<string, unknown> | undefined) {
  return {
    id: 4001,
    iid: 7,
    project_id: Number(ALLOWED_PROJECT_ID),
    title: String(body?.title ?? ""),
    description: null,
    state: "opened",
    author: user(1),
    source_branch: String(body?.source_branch ?? ""),
    target_branch: String(body?.target_branch ?? ""),
    web_url: `http://gitlab.test/${ALLOWED_PROJECT_PATH}/-/merge_requests/7`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
  };
}

function graphqlResponse(body: Record<string, unknown> | undefined): unknown {
  const query = typeof body?.query === "string" ? body.query : "";
  const variables = (body?.variables ?? {}) as Record<string, unknown>;
  if (query.includes("awardEmojiAdd(")) {
    return {
      data: {
        awardEmojiAdd: {
          awardEmoji: { name: variables.name, user: { username: "tester" } },
          errors: [],
        },
      },
    };
  }
  if (query.includes("awardEmojiRemove(")) {
    return {
      data: { awardEmojiRemove: { awardEmoji: { name: variables.name }, errors: [] } },
    };
  }
  if (query.includes("awardable(")) {
    return {
      data: {
        awardable: { awardEmoji: { nodes: [{ name: "eyes", user: { username: "someone" } }] } },
      },
    };
  }
  if (query.includes("workItem(iid:")) {
    const found =
      variables.path === ALLOWED_PROJECT_PATH && variables.iid === String(WORK_ITEM_IID);
    return { data: { namespace: { workItem: found ? { id: WORK_ITEM_GID } : null } } };
  }
  if (query.includes("note(id:")) {
    return { data: { note: NOTES[String(variables.id)] ?? null } };
  }
  return { errors: [{ message: "unexpected GraphQL request" }] };
}

async function startAllowlistServer(t: TestContext): Promise<AllowlistServer> {
  const requests: RecordedRequest[] = [];
  const api = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const method = req.method ?? "GET";
      const path = requestPath(req.url ?? "");
      const body = parseBody(Buffer.concat(chunks).toString("utf8"));
      requests.push({ method, path, body });
      res.setHeader("Content-Type", "application/json");

      if (method === "GET" && path === `/api/v4/projects/${ALLOWED_PROJECT_ID}`) {
        res.end(
          JSON.stringify({
            id: Number(ALLOWED_PROJECT_ID),
            name: "Allowed",
            path_with_namespace: ALLOWED_PROJECT_PATH,
          })
        );
        return;
      }
      if (method === "POST" && path === `/api/v4/projects/${ALLOWED_PROJECT_ID}/issues/1/links`) {
        res.statusCode = 201;
        res.end(
          JSON.stringify({
            source_issue: issue(ALLOWED_PROJECT_ID, "1"),
            target_issue: issue(String(body?.target_project_id), String(body?.target_issue_iid)),
            link_type: body?.link_type ?? "relates_to",
          })
        );
        return;
      }
      if (method === "POST" && path === `/api/v4/projects/${ALLOWED_PROJECT_ID}/merge_requests`) {
        res.statusCode = 201;
        res.end(JSON.stringify(mergeRequest(body)));
        return;
      }
      if (method === "POST" && path === "/api/graphql") {
        res.end(JSON.stringify(graphqlResponse(body)));
        return;
      }
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "unexpected GitLab request" }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", () => resolve());
  });

  const client = new Client({ name: "allowed-project-target-scope-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: "test-token",
      GITLAB_API_URL: `http://127.0.0.1:${boundPort(api)}/api/v4`,
      GITLAB_ALLOWED_PROJECT_IDS: ALLOWED_PROJECT_ID,
      GITLAB_TOOLSETS: "issues,merge_requests,workitems",
      GITLAB_MASKING_ENABLED: "true",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
      LOG_FORMAT: "json",
    },
  });

  t.after(async () => {
    try {
      await client.close();
    } finally {
      api.closeAllConnections();
      await new Promise<void>(resolve => api.close(() => resolve()));
    }
  });

  await client.connect(transport);

  return { client, requests };
}

function deniedProjectWasRequested(requests: RecordedRequest[]): boolean {
  return requests.some(request => request.path.includes(`/projects/${DENIED_PROJECT_ID}`));
}

function postsTo(requests: RecordedRequest[], path: string): RecordedRequest[] {
  return requests.filter(request => request.method === "POST" && request.path === path);
}

const AWARD_OPERATIONS = ["awardEmojiAdd(", "awardEmojiRemove(", "awardable("];

function awardRequests(requests: RecordedRequest[]): RecordedRequest[] {
  return requests.filter(request => {
    const query = request.path === "/api/graphql" ? request.body?.query : undefined;
    return typeof query === "string" && AWARD_OPERATIONS.some(op => query.includes(op));
  });
}

const NOTE_EMOJI_TOOLS = [
  {
    name: "create_work_item_note_emoji_reaction",
    extraArgs: { name: "thumbsup" },
    operation: "awardEmojiAdd(",
  },
  {
    name: "delete_work_item_note_emoji_reaction",
    extraArgs: { name: "thumbsup" },
    operation: "awardEmojiRemove(",
  },
  { name: "list_work_item_note_emoji_reactions", extraArgs: {}, operation: "awardable(" },
] as const;

describe("When GITLAB_ALLOWED_PROJECT_IDS is set", () => {
  describe("with create_issue_link", () => {
    test("should reject a target project outside the allowlist without creating the link", async t => {
      const server = await startAllowlistServer(t);

      const denied = await server.client.callTool({
        name: "create_issue_link",
        arguments: {
          project_id: ALLOWED_PROJECT_ID,
          issue_iid: "1",
          target_project_id: DENIED_PROJECT_ID,
          target_issue_iid: "5",
        },
      });

      assert.equal(denied.isError, true, resultText(denied));
      assert.equal(resultText(denied), DENIED_MESSAGE);
      assert.deepEqual(
        postsTo(server.requests, `/api/v4/projects/${ALLOWED_PROJECT_ID}/issues/1/links`),
        []
      );
      assert.equal(deniedProjectWasRequested(server.requests), false);
    });

    test("should create the link when the target project is in the allowlist", async t => {
      const server = await startAllowlistServer(t);

      const allowed = await server.client.callTool({
        name: "create_issue_link",
        arguments: {
          project_id: ALLOWED_PROJECT_ID,
          issue_iid: "1",
          target_project_id: ALLOWED_PROJECT_ID,
          target_issue_iid: "2",
        },
      });

      assert.notEqual(allowed.isError, true, resultText(allowed));
      const posts = postsTo(
        server.requests,
        `/api/v4/projects/${ALLOWED_PROJECT_ID}/issues/1/links`
      );
      assert.equal(posts.length, 1);
      assert.equal(posts[0].body?.target_project_id, ALLOWED_PROJECT_ID);
    });
  });

  describe("with create_merge_request", () => {
    const mergeRequestsPath = `/api/v4/projects/${ALLOWED_PROJECT_ID}/merge_requests`;
    const baseArgs = {
      project_id: ALLOWED_PROJECT_ID,
      title: "Feature",
      source_branch: "feature",
      target_branch: "main",
    };

    test("should reject a target project outside the allowlist without creating the merge request", async t => {
      const server = await startAllowlistServer(t);

      const denied = await server.client.callTool({
        name: "create_merge_request",
        arguments: { ...baseArgs, target_project_id: DENIED_PROJECT_ID },
      });

      assert.equal(denied.isError, true, resultText(denied));
      assert.equal(resultText(denied), DENIED_MESSAGE);
      assert.deepEqual(postsTo(server.requests, mergeRequestsPath), []);
      assert.equal(deniedProjectWasRequested(server.requests), false);
    });

    test("should create the merge request when the target project is in the allowlist", async t => {
      const server = await startAllowlistServer(t);

      const allowed = await server.client.callTool({
        name: "create_merge_request",
        arguments: { ...baseArgs, target_project_id: ALLOWED_PROJECT_ID },
      });

      assert.notEqual(allowed.isError, true, resultText(allowed));
      const posts = postsTo(server.requests, mergeRequestsPath);
      assert.equal(posts.length, 1);
      assert.equal(posts[0].body?.target_project_id, ALLOWED_PROJECT_ID);
    });

    test("should not add a target project when none is given", async t => {
      const server = await startAllowlistServer(t);

      const allowed = await server.client.callTool({
        name: "create_merge_request",
        arguments: baseArgs,
      });

      assert.notEqual(allowed.isError, true, resultText(allowed));
      const posts = postsTo(server.requests, mergeRequestsPath);
      assert.equal(posts.length, 1);
      assert.equal(posts[0].body !== undefined && "target_project_id" in posts[0].body, false);
    });
  });

  for (const tool of NOTE_EMOJI_TOOLS) {
    describe(`with ${tool.name}`, () => {
      test("should reject a note that belongs to another issue", async t => {
        const server = await startAllowlistServer(t);

        const denied = await server.client.callTool({
          name: tool.name,
          arguments: {
            project_id: ALLOWED_PROJECT_ID,
            iid: WORK_ITEM_IID,
            note_id: FOREIGN_ISSUE_NOTE_GID,
            ...tool.extraArgs,
          },
        });

        assert.equal(denied.isError, true, resultText(denied));
        assert.equal(resultText(denied), noteDeniedMessage(FOREIGN_ISSUE_NOTE_GID));
        assert.deepEqual(awardRequests(server.requests), []);
      });

      test("should reject a project outside the allowlist", async t => {
        const server = await startAllowlistServer(t);

        const denied = await server.client.callTool({
          name: tool.name,
          arguments: {
            project_id: DENIED_PROJECT_ID,
            iid: WORK_ITEM_IID,
            note_id: FOREIGN_ISSUE_NOTE_GID,
            ...tool.extraArgs,
          },
        });

        assert.equal(denied.isError, true, resultText(denied));
        assert.equal(resultText(denied), DENIED_MESSAGE);
        assert.deepEqual(awardRequests(server.requests), []);
        assert.equal(deniedProjectWasRequested(server.requests), false);
      });

      test("should act on a note that belongs to the work item", async t => {
        const server = await startAllowlistServer(t);

        const allowed = await server.client.callTool({
          name: tool.name,
          arguments: {
            project_id: ALLOWED_PROJECT_ID,
            iid: WORK_ITEM_IID,
            note_id: OWN_NOTE_GID,
            ...tool.extraArgs,
          },
        });

        assert.notEqual(allowed.isError, true, resultText(allowed));
        const award = awardRequests(server.requests);
        assert.equal(award.length, 1);
        assert.ok(String(award[0].body?.query).includes(tool.operation));
        const variables = award[0].body?.variables as Record<string, unknown> | undefined;
        assert.equal(variables?.awardableId ?? variables?.id, OWN_NOTE_GID);
      });
    });
  }

  describe("with create_work_item_note_emoji_reaction and a note_id outside the work item", () => {
    const callWithNote = (server: AllowlistServer, noteId: string) =>
      server.client.callTool({
        name: "create_work_item_note_emoji_reaction",
        arguments: {
          project_id: ALLOWED_PROJECT_ID,
          iid: WORK_ITEM_IID,
          note_id: noteId,
          name: "thumbsup",
        },
      });

    test("should reject a merge request note with the same numeric id as the work item", async t => {
      const server = await startAllowlistServer(t);

      const denied = await callWithNote(server, MERGE_REQUEST_NOTE_GID);

      assert.equal(denied.isError, true, resultText(denied));
      assert.equal(resultText(denied), noteDeniedMessage(MERGE_REQUEST_NOTE_GID));
      assert.deepEqual(awardRequests(server.requests), []);
    });

    test("should reject a note that cannot be found", async t => {
      const server = await startAllowlistServer(t);

      const denied = await callWithNote(server, MISSING_NOTE_GID);

      assert.equal(denied.isError, true, resultText(denied));
      assert.equal(resultText(denied), noteDeniedMessage(MISSING_NOTE_GID));
      assert.deepEqual(awardRequests(server.requests), []);
    });

    test("should reject a global ID that is not a note", async t => {
      const server = await startAllowlistServer(t);

      const denied = await callWithNote(server, "gid://gitlab/Issue/888");

      assert.equal(denied.isError, true, resultText(denied));
      assert.match(resultText(denied), /note_id must be a note global ID/);
      assert.deepEqual(awardRequests(server.requests), []);
    });
  });
});
