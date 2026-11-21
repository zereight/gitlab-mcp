/**
 * Regression check for the variables toolset (tools/variables.ts).
 *
 * The ten CI/CD variable tools live outside index.ts and get the auth fetch,
 * GitLab error handling and project-scope guards from configureVariableTools().
 * This runs build/index.js over stdio against a recording GitLab stub and checks
 * what each tool lists, which request it sends, and that those guards still apply.
 */
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const TOKEN = "glpat-variables-toolset-0000";

const VARIABLE_TOOLS = [
  "list_project_variables",
  "get_project_variable",
  "create_project_variable",
  "update_project_variable",
  "delete_project_variable",
  "list_group_variables",
  "get_group_variable",
  "create_group_variable",
  "update_group_variable",
  "delete_group_variable",
];
const READ_TOOLS = VARIABLE_TOOLS.filter(name => /^(list|get)_/.test(name));

interface RecordedRequest {
  method: string;
  url: string;
  token: string | undefined;
  body: unknown;
}

const variable = (key: string) => ({
  variable_type: "env_var",
  key,
  value: "v",
  protected: false,
  masked: false,
  raw: false,
  environment_scope: "*",
  description: null,
});

async function startGitLab(
  t: TestContext
): Promise<{ apiUrl: string; requests: RecordedRequest[] }> {
  const requests: RecordedRequest[] = [];
  const api = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => (raw += chunk));
    req.on("end", () => {
      const url = req.url ?? "";
      const auth = req.headers["private-token"] ?? req.headers.authorization;
      requests.push({
        method: req.method ?? "",
        url,
        token: Array.isArray(auth) ? auth[0] : auth,
        body: raw ? JSON.parse(raw) : undefined,
      });
      res.setHeader("content-type", "application/json");
      if (url.includes("/variables/MISSING")) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: "404 Variable Not Found" }));
        return;
      }
      if (req.method === "DELETE") {
        res.statusCode = 204;
        res.end();
        return;
      }
      const key = /\/variables\/([^/?]+)/.exec(url)?.[1];
      if (req.method === "GET" && !key) {
        res.end(JSON.stringify([variable("LISTED")]));
        return;
      }
      res.statusCode = req.method === "POST" ? 201 : 200;
      const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      res.end(JSON.stringify({ ...variable(key ?? String(body.key)), ...body }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    api.closeAllConnections();
    await new Promise<void>(resolve => api.close(() => resolve()));
  });
  return { apiUrl: `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/v4`, requests };
}

async function connect(
  t: TestContext,
  apiUrl: string,
  env: Record<string, string> = {}
): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: TOKEN,
      GITLAB_API_URL: apiUrl,
      GITLAB_TOOLSETS: "variables",
      GITLAB_PERMISSION_MODE: "full",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      LOG_LEVEL: "error",
      ...env,
    },
  });
  transport.stderr?.on("data", () => undefined);
  const client = new Client({ name: "variables-toolset-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

/** Calls a tool and returns its text, whether it fails as a tool result or a JSON-RPC error. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<{ isError: boolean; text: string; meta: unknown }> {
  try {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }>;
    return {
      isError: result.isError === true,
      text: content.map(part => part.text ?? "").join(""),
      meta: result._meta,
    };
  } catch (error) {
    return { isError: true, text: (error as Error).message, meta: undefined };
  }
}

describe("variables toolset (tools/variables.ts)", () => {
  test("lists the ten variable tools, and only the read ones in read-only mode", async t => {
    const { apiUrl } = await startGitLab(t);
    const full = await connect(t, apiUrl);
    const readOnly = await connect(t, apiUrl, { GITLAB_PERMISSION_MODE: "readonly" });

    const listed = (await full.listTools()).tools.filter(tool =>
      VARIABLE_TOOLS.includes(tool.name)
    );
    assert.deepEqual(listed.map(tool => tool.name).sort(), [...VARIABLE_TOOLS].sort());
    for (const tool of listed) {
      assert.equal(tool.inputSchema.type, "object", tool.name);
      assert.ok(tool.inputSchema.required?.includes("key") || /^list_/.test(tool.name), tool.name);
    }

    const readOnlyNames = (await readOnly.listTools()).tools
      .map(tool => tool.name)
      .filter(name => VARIABLE_TOOLS.includes(name));
    assert.deepEqual(readOnlyNames.sort(), [...READ_TOOLS].sort());
  });

  test("sends each tool's request to the GitLab variables API with the token", async t => {
    const { apiUrl, requests } = await startGitLab(t);
    const client = await connect(t, apiUrl);
    const project = "grp/app";
    const group = "grp/sub";
    const scope = { filter: { environment_scope: "production" } };

    const calls: Array<[string, Record<string, unknown>]> = [
      ["list_project_variables", { project_id: project }],
      ["get_project_variable", { project_id: project, key: "DB_URL", ...scope }],
      [
        "create_project_variable",
        { project_id: project, key: "NEW_KEY", value: "x", masked: true },
      ],
      ["update_project_variable", { project_id: project, key: "DB_URL", value: "y", ...scope }],
      ["delete_project_variable", { project_id: project, key: "DB_URL", ...scope }],
      ["list_group_variables", { group_id: group }],
      ["get_group_variable", { group_id: group, key: "SHARED" }],
      ["create_group_variable", { group_id: group, key: "G_NEW", value: "z", protected: true }],
      ["update_group_variable", { group_id: group, key: "SHARED", value: "w" }],
      ["delete_group_variable", { group_id: group, key: "SHARED" }],
    ];
    for (const [name, args] of calls) {
      const result = await call(client, name, args);
      assert.equal(result.isError, false, `${name}: ${result.text}`);
    }

    const filter = "filter%5Benvironment_scope%5D=production";
    assert.deepEqual(
      requests.map(
        request => `${request.method} ${request.url.replace(/[?&]page=1(&per_page=\d+)?$/, "")}`
      ),
      [
        "GET /api/v4/projects/grp%2Fapp/variables",
        `GET /api/v4/projects/grp%2Fapp/variables/DB_URL?${filter}`,
        "POST /api/v4/projects/grp%2Fapp/variables",
        `PUT /api/v4/projects/grp%2Fapp/variables/DB_URL?${filter}`,
        `DELETE /api/v4/projects/grp%2Fapp/variables/DB_URL?${filter}`,
        "GET /api/v4/groups/grp%2Fsub/variables",
        "GET /api/v4/groups/grp%2Fsub/variables/SHARED",
        "POST /api/v4/groups/grp%2Fsub/variables",
        "PUT /api/v4/groups/grp%2Fsub/variables/SHARED",
        "DELETE /api/v4/groups/grp%2Fsub/variables/SHARED",
      ]
    );
    assert.ok(
      requests.every(request => request.token?.includes(TOKEN)),
      "every request should carry the configured token"
    );
    assert.deepEqual(requests[2].body, { key: "NEW_KEY", value: "x", masked: true });
    assert.deepEqual(requests[3].body, { value: "y" });
    assert.deepEqual(requests[7].body, { key: "G_NEW", value: "z", protected: true });
    assert.deepEqual(requests[8].body, { value: "w" });
  });

  test("returns a GitLab 404 as a tool error with the HTTP status", async t => {
    const { apiUrl } = await startGitLab(t);
    const client = await connect(t, apiUrl);

    for (const [name, args] of [
      ["get_project_variable", { project_id: "123", key: "MISSING" }],
      ["get_group_variable", { group_id: "grp", key: "MISSING" }],
    ] as const) {
      const result = await call(client, name, args);
      assert.equal(result.isError, true, name);
      assert.match(result.text, /404/, name);
      assert.match(result.text, /Variable Not Found/, name);
      assert.deepEqual(
        result.meta,
        { "io.github.zereight.gitlab-mcp/http-error": { status: 404 } },
        name
      );
    }
  });

  test("applies GITLAB_ALLOWED_PROJECT_IDS to project and group variable tools", async t => {
    const { apiUrl, requests } = await startGitLab(t);
    const client = await connect(t, apiUrl, { GITLAB_ALLOWED_PROJECT_IDS: "123" });

    const allowed = await call(client, "list_project_variables", { project_id: "123" });
    assert.equal(allowed.isError, false, allowed.text);

    const denied = await call(client, "list_project_variables", { project_id: "999" });
    assert.equal(denied.isError, true);
    assert.match(denied.text, /Access denied: Project 999 is not in the allowed project list: 123/);

    const group = await call(client, "list_group_variables", { group_id: "grp" });
    assert.equal(group.isError, true);
    assert.match(
      group.text,
      /list_group_variables is not allowed while a project allowlist is in effect/
    );

    assert.deepEqual(
      requests.map(request => request.url.split("?")[0]),
      ["/api/v4/projects/123/variables"],
      "denied calls must not reach GitLab"
    );
  });

  test("rejects group variable tools when GITLAB_PROJECT_ID locks the server to one project", async t => {
    const { apiUrl, requests } = await startGitLab(t);
    const client = await connect(t, apiUrl, { GITLAB_PROJECT_ID: "123" });

    for (const name of ["list_group_variables", "create_group_variable"]) {
      const result = await call(client, name, { group_id: "grp", key: "K", value: "v" });
      assert.equal(result.isError, true, name);
      assert.match(
        result.text,
        new RegExp(`${name} is not allowed when GITLAB_PROJECT_ID is set`),
        name
      );
    }
    assert.deepEqual(requests, []);
  });
});
