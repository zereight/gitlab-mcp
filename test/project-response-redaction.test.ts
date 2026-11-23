import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Request, Response } from "express";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-project-redaction-test";
const PROJECT_ID = "123";
const GROUP_ID = "7";
const PROJECT_NAME = "sentinel-project";
const GROUP_PATH = "sentinel-group";
const RUNNERS_TOKEN_SENTINEL = "RUNNERS_TOKEN_SENTINEL_NOT_A_CREDENTIAL";
const IMPORT_URL_SENTINEL = "IMPORT_URL_SENTINEL_NOT_A_CREDENTIAL";

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

// A project as an Owner sees it: valid for GitLabRepositorySchema, plus the
// credential-bearing fields that redactSensitiveGitLabFields removes.
function sensitiveProject(): Record<string, unknown> {
  return {
    id: Number(PROJECT_ID),
    name: PROJECT_NAME,
    path_with_namespace: `${GROUP_PATH}/${PROJECT_NAME}`,
    description: null,
    default_branch: "main",
    web_url: `https://gitlab.example.test/${GROUP_PATH}/${PROJECT_NAME}`,
    runners_token: RUNNERS_TOKEN_SENTINEL,
    import_url: `https://user:${IMPORT_URL_SENTINEL}@invalid.example/repository.git`,
  };
}

// A group as an Owner sees it: valid for GitLabGroupSchema, with its own
// runners_token and an embedded project carrying credentials.
function sensitiveGroup(): Record<string, unknown> {
  return {
    id: Number(GROUP_ID),
    name: GROUP_PATH,
    path: GROUP_PATH,
    description: null,
    web_url: `https://gitlab.example.test/groups/${GROUP_PATH}`,
    full_name: GROUP_PATH,
    full_path: GROUP_PATH,
    runners_token: RUNNERS_TOKEN_SENTINEL,
    projects: [sensitiveProject()],
  };
}

function resultText(result: ToolResult): string {
  assert.notEqual(result.isError, true, `tool returned an error: ${JSON.stringify(result)}`);
  assert.ok("content" in result && Array.isArray(result.content), "expected tool content");
  const texts = result.content.flatMap((item: unknown) =>
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    item.type === "text" &&
    "text" in item &&
    typeof item.text === "string"
      ? [item.text]
      : []
  );
  assert.ok(texts.length > 0, "expected a text tool result");
  return texts.join("\n");
}

function assertNoProjectCredentials(result: ToolResult): void {
  const serialized = JSON.stringify(result);
  const leaked = [
    RUNNERS_TOKEN_SENTINEL,
    IMPORT_URL_SENTINEL,
    "runners_token",
    "import_url",
  ].filter(marker => serialized.includes(marker));

  assert.deepEqual(leaked, []);
}

describe("When a tool returns a GitLab project", { concurrency: false, timeout: 60_000 }, () => {
  const requests: { method: string; path: string; body: unknown }[] = [];
  let mockGitLab: MockGitLabServer;
  let client: Client;

  function requested(method: string, path: string): boolean {
    return requests.some(request => request.method === method && request.path === path);
  }

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });

    const respond =
      (payload: () => unknown, status = 200) =>
      (req: Request, res: Response) => {
        requests.push({
          method: req.method,
          path: req.originalUrl.split("?")[0],
          body: req.body,
        });
        res.status(status).json(payload());
      };

    mockGitLab.addMockHandler("put", `/projects/${PROJECT_ID}`, respond(sensitiveProject));
    mockGitLab.addMockHandler("get", `/projects/${PROJECT_ID}`, respond(sensitiveProject));
    mockGitLab.addMockHandler(
      "post",
      `/projects/${PROJECT_ID}/fork`,
      respond(sensitiveProject, 201)
    );
    mockGitLab.addMockHandler("post", "/projects", respond(sensitiveProject, 201));
    mockGitLab.addMockHandler(
      "get",
      "/projects",
      respond(() => [sensitiveProject()])
    );
    mockGitLab.addMockHandler(
      "get",
      `/groups/${GROUP_ID}/projects`,
      respond(() => [sensitiveProject()])
    );
    mockGitLab.addMockHandler("post", "/groups", respond(sensitiveGroup, 201));
    await mockGitLab.start();

    client = new Client({ name: "project-response-redaction-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["build/index.js"],
      stderr: "pipe",
      env: {
        ...getDefaultEnvironment(),
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        GITLAB_TOOLSETS: "branches,projects,groups,repositories",
        GITLAB_PERMISSION_MODE: "modify",
        GITLAB_PROJECT_ID: "",
        GITLAB_ALLOWED_PROJECT_IDS: "",
        GITLAB_DISABLE_VERSION_CHECK: "true",
        LOG_LEVEL: "error",
      },
    });
    transport.stderr?.on("data", () => undefined);
    await client.connect(transport);
  });

  beforeEach(() => {
    requests.length = 0;
  });

  after(async () => {
    try {
      await client?.close();
    } finally {
      await mockGitLab?.stop();
    }
  });

  describe("with update_default_branch", () => {
    test("should drop runners_token and import_url and keep other project fields", async () => {
      const result = await client.callTool({
        name: "update_default_branch",
        arguments: { project_id: PROJECT_ID, default_branch: "main" },
      });
      const payload = JSON.parse(resultText(result));

      assert.equal(payload.status, "updated");
      assert.equal(payload.default_branch, "main");
      assert.equal(payload.project.name, PROJECT_NAME);
      assert.equal(payload.project.path_with_namespace, `${GROUP_PATH}/${PROJECT_NAME}`);
      assert.ok(
        requests.some(
          request =>
            request.method === "PUT" &&
            request.path === `/api/v4/projects/${PROJECT_ID}` &&
            JSON.stringify(request.body) === JSON.stringify({ default_branch: "main" })
        ),
        "expected PUT /projects/:id with the default_branch body"
      );
      assertNoProjectCredentials(result);
    });
  });

  describe("with update_project", () => {
    test("should drop runners_token and import_url like update_default_branch", async () => {
      const result = await client.callTool({
        name: "update_project",
        arguments: { project_id: PROJECT_ID, description: "redaction control" },
      });
      const payload = JSON.parse(resultText(result));

      assert.equal(payload.name, PROJECT_NAME);
      assert.ok(requested("PUT", `/api/v4/projects/${PROJECT_ID}`));
      assertNoProjectCredentials(result);
    });
  });

  describe("with get_project", () => {
    test("should drop runners_token and import_url", async () => {
      const result = await client.callTool({
        name: "get_project",
        arguments: { project_id: PROJECT_ID },
      });
      const payload = JSON.parse(resultText(result));

      assert.equal(payload.name, PROJECT_NAME);
      assert.ok(requested("GET", `/api/v4/projects/${PROJECT_ID}`));
      assertNoProjectCredentials(result);
    });
  });

  // These tools parse GitLab responses through strict Zod object schemas, which
  // drop unknown keys. Pin that so a future .passthrough() cannot reintroduce
  // the credential fields.
  describe("with schema-parsed project and group results", () => {
    const cases: {
      name: string;
      arguments: Record<string, unknown>;
      method: string;
      path: string;
      benign: string;
    }[] = [
      {
        name: "fork_repository",
        arguments: { project_id: PROJECT_ID },
        method: "POST",
        path: `/api/v4/projects/${PROJECT_ID}/fork`,
        benign: PROJECT_NAME,
      },
      {
        name: "create_repository",
        arguments: { name: PROJECT_NAME },
        method: "POST",
        path: "/api/v4/projects",
        benign: PROJECT_NAME,
      },
      {
        name: "list_projects",
        arguments: {},
        method: "GET",
        path: "/api/v4/projects",
        benign: PROJECT_NAME,
      },
      {
        name: "search_repositories",
        arguments: { search: PROJECT_NAME },
        method: "GET",
        path: "/api/v4/projects",
        benign: PROJECT_NAME,
      },
      {
        name: "list_group_projects",
        arguments: { group_id: GROUP_ID },
        method: "GET",
        path: `/api/v4/groups/${GROUP_ID}/projects`,
        benign: PROJECT_NAME,
      },
      {
        name: "create_group",
        arguments: { name: GROUP_PATH, path: GROUP_PATH },
        method: "POST",
        path: "/api/v4/groups",
        benign: GROUP_PATH,
      },
    ];

    for (const testCase of cases) {
      test(`${testCase.name} should not return runners_token or import_url`, async () => {
        const result = await client.callTool({
          name: testCase.name,
          arguments: testCase.arguments,
        });

        assert.ok(resultText(result).includes(testCase.benign));
        assert.ok(requested(testCase.method, testCase.path));
        assertNoProjectCredentials(result);
      });
    }
  });
});
