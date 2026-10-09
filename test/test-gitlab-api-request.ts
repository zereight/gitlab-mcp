import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const TOKEN = "api-request-test-token";
const SECRET = "glpat-abcdefghijklmnopqrst";

interface ToolText {
  readonly isError: boolean;
  readonly text: string;
}

function readCategoryIds(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("categories" in value)) {
    return [];
  }
  const categories = value.categories;
  if (!Array.isArray(categories)) {
    return [];
  }
  const ids: string[] = [];
  for (const category of categories) {
    if (
      category &&
      typeof category === "object" &&
      "id" in category &&
      typeof category.id === "string"
    ) {
      ids.push(category.id);
    }
  }
  return ids;
}

function readToolText(result: unknown): ToolText {
  if (!result || typeof result !== "object") {
    throw new Error("missing tool result");
  }
  const isError = "isError" in result && result.isError === true;
  if (!("content" in result) || !Array.isArray(result.content) || result.content.length === 0) {
    throw new Error("missing tool content");
  }
  const block = result.content[0];
  if (!block || typeof block !== "object" || !("text" in block) || typeof block.text !== "string") {
    throw new Error("missing tool text");
  }
  return { isError, text: block.text };
}

async function withClient(
  extraEnv: Record<string, string>,
  run: (client: Client, stderr: () => string, mock: MockGitLabServer) => Promise<void>
): Promise<void> {
  const mock = new MockGitLabServer({
    port: await findMockServerPort(),
    validTokens: [TOKEN],
  });
  await mock.start();
  const stderrChunks: string[] = [];
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-api-request-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("build/index.js")],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: TOKEN,
      GITLAB_API_URL: `${mock.getUrl()}/api/v4`,
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_FORMAT: "json",
      LOG_LEVEL: "info",
      GITLAB_READ_ONLY_MODE: "false",
      GITLAB_PERMISSION_MODE: "full",
      GITLAB_TOOLSETS: "",
      GITLAB_TOOLS: "",
      GITLAB_DENIED_TOOLS_REGEX: "",
      GITLAB_TOOL_PROFILE: "full",
      USE_PIPELINE: "false",
      USE_MILESTONE: "false",
      USE_GITLAB_WIKI: "false",
      GITLAB_MASKING_ENABLED: "false",
      GITLAB_MASKING_POLICY_FILE: "",
      GITLAB_MASKING_CONFIG: "",
      GITLAB_MASKING_WORKSPACE_DIR: workspace,
      ...extraEnv,
    },
  });
  transport.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString("utf8"));
  });
  const client = new Client({ name: "gitlab-api-request-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    await run(client, () => stderrChunks.join(""), mock);
  } finally {
    await client.close();
    await mock.stop();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

async function toolNames(client: Client): Promise<string[]> {
  const listed = await client.listTools();
  return listed.tools.map(tool => tool.name);
}

describe("When gitlab_api_request is not opted in", { timeout: 120_000 }, () => {
  describe("with the default toolsets", () => {
    it("should hide the tool", async () => {
      await withClient({}, async client => {
        const names = await toolNames(client);
        assert.equal(names.includes("gitlab_api_request"), false);
      });
    });
  });

  describe("with GITLAB_TOOLSETS=all", () => {
    it("should hide the tool and refuse discover_tools activation", async () => {
      await withClient({ GITLAB_TOOLSETS: "all" }, async client => {
        const names = await toolNames(client);
        assert.equal(names.includes("gitlab_api_request"), false);

        const listed = readToolText(
          await client.callTool({ name: "discover_tools", arguments: {} })
        );
        const parsed: unknown = JSON.parse(listed.text);
        const categoryIds = readCategoryIds(parsed);
        assert.equal(categoryIds.includes("api"), false);

        const activated = readToolText(
          await client.callTool({ name: "discover_tools", arguments: { category: "api" } })
        );
        assert.equal(activated.isError, true);
        assert.match(activated.text, /GITLAB_TOOLSETS/);
      });
    });
  });

  describe("with only GITLAB_TOOLS=gitlab_api_request", () => {
    it("should hide the tool and warn", async () => {
      await withClient({ GITLAB_TOOLS: "gitlab_api_request" }, async (client, stderr) => {
        const names = await toolNames(client);
        assert.equal(names.includes("gitlab_api_request"), false);
        assert.match(stderr(), /GITLAB_TOOLS entry is ignored/);
      });
    });
  });
});

describe("When the api toolset is listed", { timeout: 180_000 }, () => {
  describe("with GITLAB_TOOLSETS=api", () => {
    it("should expose the tool and warn at startup", async () => {
      await withClient({ GITLAB_TOOLSETS: "api" }, async (client, stderr) => {
        const listed = await client.listTools();
        const tool = listed.tools.find(item => item.name === "gitlab_api_request");
        assert.ok(tool);
        assert.equal(tool.annotations?.destructiveHint, true);
        assert.equal(tool.annotations?.readOnlyHint, undefined);
        assert.match(stderr(), /full token scope/);
      });
    });
  });

  describe("with GITLAB_TOOLSETS=core,api", () => {
    it("should expose the tool", async () => {
      await withClient({ GITLAB_TOOLSETS: "core,api" }, async client => {
        const names = await toolNames(client);
        assert.equal(names.includes("gitlab_api_request"), true);
      });
    });
  });

  describe("with GITLAB_DENIED_TOOLS_REGEX matching the tool", () => {
    it("should hide gitlab_api_request", async () => {
      await withClient(
        { GITLAB_TOOLSETS: "api", GITLAB_DENIED_TOOLS_REGEX: "gitlab_api_request" },
        async client => {
          const names = await toolNames(client);
          assert.equal(names.includes("gitlab_api_request"), false);
        }
      );
    });
  });

  describe("with a normal GET", () => {
    it("should return pretty JSON", async () => {
      await withClient({ GITLAB_TOOLSETS: "api" }, async (client, _stderr, mock) => {
        mock.addMockHandler("get", "/projects/5", (_req, res) => {
          res.json({ id: 5, title: "demo" });
        });
        const result = readToolText(
          await client.callTool({
            name: "gitlab_api_request",
            arguments: { path: "/projects/5" },
          })
        );
        assert.equal(result.isError, false);
        assert.match(result.text, /\n/);
        assert.equal(JSON.parse(result.text).title, "demo");
      });
    });
  });

  describe("with query parameters", () => {
    it("should encode them", async () => {
      await withClient({ GITLAB_TOOLSETS: "api" }, async (client, _stderr, mock) => {
        const seen: { search?: unknown; page?: unknown; labels?: unknown } = {};
        mock.addMockHandler("get", "/projects/5", (req, res) => {
          seen.search = req.query.search;
          seen.page = req.query.page;
          seen.labels = req.query.labels;
          res.json({ ok: true });
        });
        await client.callTool({
          name: "gitlab_api_request",
          arguments: {
            path: "projects/5",
            query: { search: "a b", page: 2, labels: ["x", "y"] },
          },
        });
        assert.equal(seen.search, "a b");
        assert.equal(seen.page, "2");
        assert.deepEqual(seen.labels, ["x", "y"]);
      });
    });
  });

  describe("with a jmespath filter", () => {
    it("should return the filtered JSON", async () => {
      await withClient({ GITLAB_TOOLSETS: "api" }, async (client, _stderr, mock) => {
        mock.addMockHandler("get", "/projects/5", (_req, res) => {
          res.json({ items: [{ name: "a" }, { name: "b" }] });
        });
        const result = readToolText(
          await client.callTool({
            name: "gitlab_api_request",
            arguments: { path: "projects/5", jmespath: "items[].name" },
          })
        );
        assert.deepEqual(JSON.parse(result.text), ["a", "b"]);
      });
    });
  });

  describe("with a token in the JSON body and masking enabled", () => {
    it("should redact the token", async () => {
      await withClient(
        { GITLAB_TOOLSETS: "api", GITLAB_MASKING_ENABLED: "true" },
        async (client, _stderr, mock) => {
          mock.addMockHandler("get", "/projects/5", (_req, res) => {
            res.json({ note: SECRET, title: "visible" });
          });
          const result = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { path: "projects/5" },
            })
          );
          assert.equal(result.text.includes(SECRET), false);
          assert.match(result.text, /\[Token masked\]/);
        }
      );
    });
  });

  describe("with an absolute URL path", () => {
    it("should reject the call", async () => {
      await withClient({ GITLAB_TOOLSETS: "api" }, async client => {
        const result = readToolText(
          await client.callTool({
            name: "gitlab_api_request",
            arguments: { path: "https://evil.example/api/v4/user" },
          })
        );
        assert.equal(result.isError, true);
        assert.match(result.text, /relative path/);
      });
    });
  });

  describe("with readonly mode", () => {
    it("should allow GET and reject POST", async () => {
      await withClient(
        { GITLAB_TOOLSETS: "api", GITLAB_PERMISSION_MODE: "readonly" },
        async (client, _stderr, mock) => {
          mock.addMockHandler("get", "/projects/5", (_req, res) => {
            res.json({ id: 5 });
          });
          const got = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { path: "projects/5" },
            })
          );
          assert.equal(got.isError, false);

          const posted = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { method: "POST", path: "projects/5", body: { title: "x" } },
            })
          );
          assert.equal(posted.isError, true);
          assert.match(posted.text, /only GET/);
        }
      );
    });
  });

  describe("with GITLAB_READ_ONLY_MODE=true", () => {
    it("should reject POST even if permission mode is full", async () => {
      await withClient(
        {
          GITLAB_TOOLSETS: "api",
          GITLAB_READ_ONLY_MODE: "true",
          GITLAB_PERMISSION_MODE: "full",
        },
        async client => {
          const result = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { method: "POST", path: "projects/5", body: { title: "x" } },
            })
          );
          assert.equal(result.isError, true);
          assert.match(result.text, /only GET/);
        }
      );
    });
  });

  describe("with GITLAB_TOOL_POLICY_APPROVE", () => {
    it("should require confirmation before the request", async () => {
      await withClient(
        { GITLAB_TOOLSETS: "api", GITLAB_TOOL_POLICY_APPROVE: "gitlab_api_request" },
        async (client, _stderr, mock) => {
          mock.addMockHandler("get", "/projects/5", (_req, res) => {
            res.json({ id: 5 });
          });
          const blocked = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { path: "projects/5" },
            })
          );
          assert.match(blocked.text, /requires confirmation/);

          const allowed = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { path: "projects/5", _confirmed: true },
            })
          );
          assert.equal(allowed.isError, false);
        }
      );
    });
  });

  describe("with modify mode", () => {
    it("should reject DELETE", async () => {
      await withClient(
        { GITLAB_TOOLSETS: "api", GITLAB_PERMISSION_MODE: "modify" },
        async client => {
          const result = readToolText(
            await client.callTool({
              name: "gitlab_api_request",
              arguments: { method: "DELETE", path: "projects/5" },
            })
          );
          assert.equal(result.isError, true);
          assert.match(result.text, /DELETE/);
        }
      );
    });
  });
});
