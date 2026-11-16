/**
 * Regression test: with masking enabled, the CI/CD variable tools must not
 * return the value of a variable that GitLab flags `masked` or `hidden`.
 *
 * Runs build/index.js over stdio against a GitLab stub, so the check covers the
 * real tool result path (JSON text, JMESPath projection and masking). With
 * masking disabled the values come back unchanged.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

const TOKEN = "glpat-variables-masking-flags-0000";
const SERVER_ENTRY = path.resolve("build/index.js");
const REPLACEMENT = "[Masked CI variable value]";

const MASKED_VALUE = "masked-plain-secret-1";
const HIDDEN_VALUE = "hidden-plain-secret-2";
const VISIBLE_VALUE = "visible-plain-value-3";

const variable = (key: string, value: string, flags: { masked?: boolean; hidden?: boolean }) => ({
  variable_type: "env_var",
  key,
  value,
  protected: false,
  masked: flags.masked ?? false,
  hidden: flags.hidden ?? false,
  raw: false,
  environment_scope: "*",
  description: null,
});

const LISTED = [
  variable("MASKED_ONE", MASKED_VALUE, { masked: true }),
  variable("HIDDEN_ONE", HIDDEN_VALUE, { masked: true, hidden: true }),
  variable("VISIBLE_ONE", VISIBLE_VALUE, {}),
];

async function startGitLab(t: TestContext): Promise<string> {
  const api = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => (raw += chunk));
    req.on("end", () => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");
      const key = /\/variables\/([^/?]+)/.exec(url)?.[1];
      if (req.method === "GET" && !key) {
        res.end(JSON.stringify(LISTED));
        return;
      }
      if (req.method === "GET") {
        res.end(JSON.stringify(LISTED.find(item => item.key === key) ?? LISTED[0]));
        return;
      }
      // create/update echo the request the way GitLab does, including the value.
      const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      res.statusCode = req.method === "POST" ? 201 : 200;
      res.end(
        JSON.stringify({ ...variable(key ?? String(body.key), "", { masked: true }), ...body })
      );
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
  return `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/v4`;
}

async function connect(t: TestContext, apiUrl: string, maskingEnabled: boolean): Promise<Client> {
  // An empty workspace, so no .gitlab-mcp-mask.json from the checkout is loaded.
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-variables-masking-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    cwd: workspace,
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      GITLAB_PERSONAL_ACCESS_TOKEN: TOKEN,
      GITLAB_API_URL: apiUrl,
      GITLAB_TOOLSETS: "variables",
      GITLAB_PERMISSION_MODE: "full",
      GITLAB_DISABLE_VERSION_CHECK: "true",
      GITLAB_MASKING_ENABLED: maskingEnabled ? "true" : "false",
      LOG_LEVEL: "error",
    },
  });
  transport.stderr?.on("data", () => undefined);
  const client = new Client({ name: "variables-masking-flags-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

async function callText(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.map(part => part.text ?? "").join("");
  assert.notEqual(result.isError, true, `${name}: ${text}`);
  const structured = result.structuredContent;
  return structured === undefined ? text : `${text}\n${JSON.stringify(structured)}`;
}

const CALLS: Array<[string, Record<string, unknown>, string[]]> = [
  ["list_project_variables", { project_id: "grp/app" }, [MASKED_VALUE, HIDDEN_VALUE]],
  ["get_project_variable", { project_id: "grp/app", key: "MASKED_ONE" }, [MASKED_VALUE]],
  ["get_project_variable", { project_id: "grp/app", key: "HIDDEN_ONE" }, [HIDDEN_VALUE]],
  [
    "create_project_variable",
    { project_id: "grp/app", key: "NEW_ONE", value: "created-secret-4", masked: true },
    ["created-secret-4"],
  ],
  [
    "update_project_variable",
    { project_id: "grp/app", key: "MASKED_ONE", value: "updated-secret-5", masked: true },
    ["updated-secret-5"],
  ],
  ["list_group_variables", { group_id: "grp" }, [MASKED_VALUE, HIDDEN_VALUE]],
  ["get_group_variable", { group_id: "grp", key: "HIDDEN_ONE" }, [HIDDEN_VALUE]],
  [
    "create_group_variable",
    { group_id: "grp", key: "G_NEW", value: "group-created-6", masked: true },
    ["group-created-6"],
  ],
  [
    "update_group_variable",
    { group_id: "grp", key: "HIDDEN_ONE", value: "group-updated-7", masked: true },
    ["group-updated-7"],
  ],
];

describe("CI/CD variable values flagged masked or hidden", () => {
  test("are replaced in every variables tool result when masking is enabled", async t => {
    const client = await connect(t, await startGitLab(t), true);
    for (const [name, args, secrets] of CALLS) {
      const text = await callText(client, name, args);
      for (const secret of secrets) assert.ok(!text.includes(secret), `${name} leaked ${secret}`);
      assert.ok(text.includes(REPLACEMENT), `${name} should show the replacement`);
    }
    const listed = await callText(client, "list_project_variables", { project_id: "grp/app" });
    assert.ok(listed.includes(VISIBLE_VALUE), "an unflagged variable value stays visible");
  });

  test("stay replaced when a JMESPath projection drops the masked flag", async t => {
    const client = await connect(t, await startGitLab(t), true);
    const text = await callText(client, "list_project_variables", {
      project_id: "grp/app",
      jmespath: "[].value",
    });
    assert.ok(!text.includes(MASKED_VALUE), text);
    assert.ok(!text.includes(HIDDEN_VALUE), text);
    assert.ok(text.includes(VISIBLE_VALUE), text);
  });

  test("are returned unchanged when masking is disabled", async t => {
    const client = await connect(t, await startGitLab(t), false);
    const text = await callText(client, "list_project_variables", { project_id: "grp/app" });
    for (const value of [MASKED_VALUE, HIDDEN_VALUE, VISIBLE_VALUE]) {
      assert.ok(text.includes(value), `masking disabled should keep ${value}`);
    }
    assert.ok(!text.includes(REPLACEMENT));
  });
});
