/**
 * Tests for the update_issue slim response (issue #563).
 * By default update_issue returns a slim confirmation; full_response=true
 * returns the complete updated issue object.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import {
  launchServer,
  findAvailablePort,
  cleanupServers,
  ServerInstance,
  TransportMode,
  HOST,
} from "./utils/server-launcher.js";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { CustomHeaderClient } from "./clients/custom-header-client.js";

const MOCK_TOKEN = "glpat-slim-update-test-token";

describe("update_issue slim response", () => {
  let mockGitLab: MockGitLabServer;
  let server: ServerInstance;
  let client: CustomHeaderClient;

  const MOCK_PORT_BASE = 9650;
  const MCP_PORT_BASE = 3650;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });
    await mockGitLab.start();

    server = await launchServer({
      mode: TransportMode.STREAMABLE_HTTP,
      port: await findAvailablePort(MCP_PORT_BASE),
      timeout: 10000,
      env: {
        STREAMABLE_HTTP: "true",
        REMOTE_AUTHORIZATION: "true",
        GITLAB_API_URL: `${mockGitLab.getUrl()}/api/v4`,
        GITLAB_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "issues",
      },
    });

    client = new CustomHeaderClient({
      headers: {
        authorization: `Bearer ${MOCK_TOKEN}`,
      },
    });
    await client.connect(`http://${HOST}:${server.port ?? 0}/mcp`);
  });

  after(async () => {
    await client?.disconnect();
    cleanupServers([server]);
    await mockGitLab?.stop();
  });

  test("default response is slim: no description echo", async () => {
    const result = await client.callTool("update_issue", {
      project_id: "test/project",
      issue_iid: "1",
      description: "A very long description that should not be echoed back",
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");

    assert.strictEqual(data.iid, "1");
    assert.strictEqual(data.state, "opened");
    assert.ok(data.title, "title should be present");
    assert.ok(data.web_url, "web_url should be present");
    assert.ok(data.updated_at, "updated_at should be present");
    assert.strictEqual(data.description, undefined, "description must not be echoed");
    assert.strictEqual(data.author, undefined, "author must not be included");
    assert.strictEqual(data.milestone, undefined, "milestone must not be included");
  });

  test("slim response reflects state changes", async () => {
    const result = await client.callTool("update_issue", {
      project_id: "test/project",
      issue_iid: "2",
      state_event: "close",
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");
    assert.strictEqual(data.state, "closed");
    assert.strictEqual(data.description, undefined);
  });

  test('full_response="false" string keeps the response slim', async () => {
    const result = await client.callTool("update_issue", {
      project_id: "test/project",
      issue_iid: "3",
      description: "A long description that should still not be echoed",
      full_response: "false",
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");

    assert.strictEqual(data.description, undefined);
    assert.strictEqual(data.author, undefined);
    assert.strictEqual(data.iid, "3");
  });

  test("full_response=true returns the complete issue object", async () => {
    const result = await client.callTool("update_issue", {
      project_id: "test/project",
      issue_iid: "4",
      description: "Full description expected in response",
      full_response: true,
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");

    assert.strictEqual(data.description, "Full description expected in response");
    assert.ok(data.author, "author should be present in full response");
    assert.strictEqual(data.iid, "4");
  });

  test("full_response is not forwarded to the GitLab API", async () => {
    const result = await client.callTool("update_issue", {
      project_id: "test/project",
      issue_iid: "5",
      title: "Updated title",
      full_response: true,
    });
    const data = JSON.parse((result.content as any)[0]?.text || "{}");
    assert.strictEqual(data.title, "Updated title");
    assert.strictEqual(data.full_response, undefined, "full_response must not leak into the issue");
  });
});
