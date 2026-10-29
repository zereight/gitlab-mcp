import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { StdioTestClient } from "./clients/stdio-client.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

// #942: with GITLAB_MCP_LIST_SUMMARY_DEFAULT=true, an omitted `summary` must not drop
// the access and protection fields these list tools exist to return.

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "123";
const TEST_GROUP_ID = "456";

const MEMBER = {
  id: 7,
  username: "alice",
  name: "Alice",
  state: "active",
  avatar_url: null,
  web_url: "https://gitlab.mock/alice",
  access_level: 40,
  created_at: "2024-01-01T00:00:00Z",
  expires_at: "2027-01-01",
};

const BRANCH = {
  name: "main",
  commit: {
    id: "abc123",
    short_id: "abc123",
    title: "Initial commit",
    author_name: "Alice",
    author_email: "alice@example.com",
    authored_date: "2024-01-01T00:00:00Z",
    committer_name: "Alice",
    committer_email: "alice@example.com",
    committed_date: "2024-01-01T00:00:00Z",
    web_url: "https://gitlab.mock/g/p/-/commit/abc123",
  },
  merged: false,
  protected: true,
  developers_can_push: false,
  developers_can_merge: false,
  can_push: true,
  default: true,
  web_url: "https://gitlab.mock/g/p/-/tree/main",
};

const PROTECTED_BRANCH = {
  id: 1,
  name: "main",
  push_access_levels: [{ id: 101, access_level: 40, access_level_description: "Maintainers" }],
  merge_access_levels: [{ id: 201, access_level: 30, access_level_description: "Developers" }],
  unprotect_access_levels: [],
  allow_force_push: false,
  code_owner_approval_required: true,
};

const PROTECTED_TAG = {
  name: "v*",
  create_access_levels: [{ id: 301, access_level: 40, access_level_description: "Maintainers" }],
};

const CASES = [
  {
    tool: "list_branches",
    args: { project_id: TEST_PROJECT_ID },
    name: BRANCH.name,
    fields: ["protected", "default", "merged"],
  },
  {
    tool: "list_protected_branches",
    args: { project_id: TEST_PROJECT_ID },
    name: PROTECTED_BRANCH.name,
    fields: ["push_access_levels", "merge_access_levels", "allow_force_push"],
  },
  {
    tool: "list_protected_tags",
    args: { project_id: TEST_PROJECT_ID },
    name: PROTECTED_TAG.name,
    fields: ["create_access_levels"],
  },
  {
    tool: "list_project_members",
    args: { project_id: TEST_PROJECT_ID },
    name: MEMBER.name,
    fields: ["access_level", "expires_at"],
  },
  {
    tool: "list_group_members",
    args: { group_id: TEST_GROUP_ID },
    name: MEMBER.name,
    fields: ["access_level", "expires_at"],
  },
];

async function callListTool(
  client: StdioTestClient,
  tool: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await client.callTool(tool, args);
  assert.notStrictEqual(result.isError, true, `${tool} failed: ${JSON.stringify(result)}`);
  const block = result.content?.[0];
  assert.ok(block && block.type === "text", `${tool} should return text content`);
  const items: unknown = JSON.parse(block.text);
  assert.ok(Array.isArray(items) && items.length === 1, `${tool} should return one item`);
  return items[0] as Record<string, unknown>;
}

describe("list summary default with access and protection fields (#942)", () => {
  let mockGitLab: MockGitLabServer;
  let baseEnv: Record<string, string>;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({ port: mockPort, validTokens: [MOCK_TOKEN] });
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/branches`,
      (_req, res) => {
        res.json([BRANCH]);
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/protected_branches`,
      (_req, res) => {
        res.json([PROTECTED_BRANCH]);
      }
    );
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/protected_tags`, (_req, res) => {
      res.json([PROTECTED_TAG]);
    });
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/members`, (_req, res) => {
      res.json([MEMBER]);
    });
    mockGitLab.addMockHandler("get", `/groups/${TEST_GROUP_ID}/members`, (_req, res) => {
      res.json([MEMBER]);
    });
    await mockGitLab.start();
    baseEnv = {
      GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_READ_ONLY_MODE: "true",
      GITLAB_TOOLSETS: "branches,tags,projects",
    };
  });

  after(async () => {
    await mockGitLab.stop();
  });

  async function withClient(
    env: Record<string, string>,
    run: (client: StdioTestClient) => Promise<void>
  ): Promise<void> {
    const client = new StdioTestClient();
    await client.connect("build/index.js", { ...baseEnv, ...env });
    try {
      await run(client);
    } finally {
      await client.disconnect();
    }
  }

  test("keeps the fields when summary is omitted and the server default is on", async () => {
    await withClient({ GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true" }, async client => {
      for (const { tool, args, fields } of CASES) {
        const item = await callListTool(client, tool, args);
        for (const field of fields) {
          assert.ok(field in item, `${tool} should keep ${field}`);
        }
      }
    });
  });

  test("still summarizes when summary is true and the server default is on", async () => {
    await withClient({ GITLAB_MCP_LIST_SUMMARY_DEFAULT: "true" }, async client => {
      for (const { tool, args, name, fields } of CASES) {
        const item = await callListTool(client, tool, { ...args, summary: true });
        assert.strictEqual(item.name, name, `${tool} summary should keep name`);
        for (const field of fields) {
          assert.strictEqual(field in item, false, `${tool} summary should drop ${field}`);
        }
      }
    });
  });

  test("keeps the fields when the server default is off", async () => {
    await withClient({ GITLAB_MCP_LIST_SUMMARY_DEFAULT: "false" }, async client => {
      for (const { tool, args, fields } of CASES) {
        const item = await callListTool(client, tool, args);
        for (const field of fields) {
          assert.ok(field in item, `${tool} should keep ${field}`);
        }
      }
    });
  });
});
