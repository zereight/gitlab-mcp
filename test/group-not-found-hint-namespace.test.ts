/**
 * A 404 from a /groups/ lookup gets its Next: hint from the tool that made the call.
 * GitLab answers a missing group with {"message":"404 Group Not Found"}, and the body alone
 * would name group_id. Namespace tools take project_id, so a missing group reached through
 * project_id must name project_id; group tools take group_id and keep the group_id hint.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Request, Response } from "express";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-namespace-group-hint-test";
const MISSING_GROUP = "missing-group";
const MISSING_PROJECT_PATH = "missing-group%2Fmissing-project";

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

function notFound(body: Record<string, unknown>) {
  return (_req: Request, res: Response) => {
    res.status(404).json(body);
  };
}

function errorText(result: ToolResult): string {
  assert.equal(result.isError, true, `expected a tool error: ${JSON.stringify(result)}`);
  const content = result.content as Array<{ type?: string; text?: string }>;
  return content.map(item => item.text ?? "").join("\n");
}

describe(
  "When a group lookup returns 404 during a tool call",
  { concurrency: false, timeout: 60_000 },
  () => {
    let mockGitLab: MockGitLabServer;
    let client: Client;

    before(async () => {
      mockGitLab = new MockGitLabServer({
        port: await findMockServerPort(),
        validTokens: [MOCK_TOKEN],
      });
      // group:<path> and group_id both resolve through GET /groups/<path>.
      mockGitLab.addMockHandler(
        "get",
        `/groups/${MISSING_GROUP}`,
        notFound({ message: "404 Group Not Found" })
      );
      // project_id="missing-group/missing-project" tries the project, then falls back to a group.
      mockGitLab.addMockHandler(
        "get",
        `/projects/${MISSING_PROJECT_PATH}`,
        notFound({ message: "404 Project Not Found" })
      );
      mockGitLab.addMockHandler(
        "get",
        `/groups/${MISSING_PROJECT_PATH}`,
        notFound({ message: "404 Group Not Found" })
      );

      await mockGitLab.start();

      client = new Client({ name: "namespace-group-hint-test", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["build/index.js"],
        stderr: "pipe",
        env: {
          ...getDefaultEnvironment(),
          GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
          GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
          GITLAB_TOOLSETS: "projects,groups,workitems",
          GITLAB_PERMISSION_MODE: "readonly",
          GITLAB_PROJECT_ID: "",
          GITLAB_ALLOWED_PROJECT_IDS: "",
          GITLAB_DISABLE_VERSION_CHECK: "true",
          LOG_LEVEL: "error",
        },
      });
      transport.stderr?.on("data", () => undefined);
      await client.connect(transport);
    });

    after(async () => {
      try {
        await client?.close();
      } finally {
        await mockGitLab?.stop();
      }
    });

    test("a namespace tool given group:<missing> names project_id, not group_id", async () => {
      const result = await client.callTool({
        name: "get_work_item",
        arguments: { project_id: `group:${MISSING_GROUP}`, iid: 1 },
      });
      const text = errorText(result);

      assert.match(text, /Group Not Found/, text);
      assert.match(text, /Next: check project_id/, text);
      assert.doesNotMatch(text, /group_id/, text);
    });

    test("a namespace tool given a missing project path names project_id, not group_id", async () => {
      const result = await client.callTool({
        name: "get_work_item",
        arguments: { project_id: "missing-group/missing-project", iid: 1 },
      });
      const text = errorText(result);

      // The fallback group lookup produced the body; the hint still names project_id.
      assert.match(text, /Group Not Found/, text);
      assert.match(text, /Next: check project_id/, text);
      assert.doesNotMatch(text, /group_id/, text);
    });

    test("a group tool given a missing group_id names group_id, not project_id", async () => {
      // list_group_iteration_cadences resolves its group through resolveGroupPath (group_id).
      const result = await client.callTool({
        name: "list_group_iteration_cadences",
        arguments: { group_id: MISSING_GROUP },
      });
      const text = errorText(result);

      assert.match(text, /Group Not Found/, text);
      assert.match(text, /Next: check group_id/, text);
      assert.doesNotMatch(text, /project_id/, text);
    });
  }
);
