import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { AUDIT_FIELD_ALLOWLIST, AUDIT_EVENT_TYPE } from "../utils/audit-log.js";
import { findMockServerPort, MockGitLabServer } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const SECRET_TOKEN = "glpat-argument-token-must-not-be-logged";
const SECRET_BODY = "confidential-issue-body-must-not-be-logged";
const MISSING_PROJECT_ID = "404-missing";
const ALLOWLISTED_FIELDS = new Set<string>(AUDIT_FIELD_ALLOWLIST);

function isAllowlistedField(key: string): boolean {
  return ALLOWLISTED_FIELDS.has(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNdjson(filePath: string): Record<string, unknown>[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const text = readFileSync(filePath, "utf8").trim();
  if (text.length === 0) {
    return [];
  }
  return text.split("\n").map(line => {
    const parsed: unknown = JSON.parse(line);
    assert.ok(isRecord(parsed), "audit line was not a JSON object");
    return parsed;
  });
}

function assertSafeAuditRecord(record: Record<string, unknown>, rawLine: string): void {
  for (const key of Object.keys(record)) {
    assert.equal(isAllowlistedField(key), true, `unexpected audit field ${key}`);
  }
  assert.equal(record.event, AUDIT_EVENT_TYPE);
  assert.equal(record.transport, "stdio");
  assert.equal(typeof record.timestamp, "string");
  assert.equal(typeof record.tool, "string");
  assert.equal(typeof record.durationMs, "number");
  assert.equal(rawLine.includes(SECRET_TOKEN), false);
  assert.equal(rawLine.includes(SECRET_BODY), false);
  assert.equal(rawLine.includes(MOCK_TOKEN), false);
  assert.equal("token" in record, false);
  assert.equal("body" in record, false);
  assert.equal("args" in record, false);
  assert.equal("headers" in record, false);
}

async function startMockGitLab(): Promise<MockGitLabServer> {
  const mockGitLab = new MockGitLabServer({
    port: await findMockServerPort(),
    validTokens: [MOCK_TOKEN],
  });
  mockGitLab.addMockHandler("get", `/projects/${MISSING_PROJECT_ID}`, (_req, res) => {
    res.status(404).json({ message: "404 Project Not Found" });
  });
  await mockGitLab.start();
  return mockGitLab;
}

function createAuditTransport(options: {
  readonly apiUrl: string;
  readonly auditLog?: string;
  readonly auditLogFile?: string;
}): StdioClientTransport {
  const env: Record<string, string> = {
    ...getDefaultEnvironment(),
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_API_URL: options.apiUrl,
    GITLAB_TOOLSETS: "projects",
    GITLAB_TOOLS: "execute_graphql",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    LOG_LEVEL: "error",
  };
  if (options.auditLog !== undefined) {
    env.GITLAB_AUDIT_LOG = options.auditLog;
  }
  if (options.auditLogFile !== undefined) {
    env.GITLAB_AUDIT_LOG_FILE = options.auditLogFile;
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    stderr: "pipe",
    env,
  });
  transport.stderr?.on("data", () => undefined);
  return transport;
}

async function withClient(
  transport: StdioClientTransport,
  run: (client: Client) => Promise<void>
): Promise<void> {
  const client = new Client({ name: "audit-log-e2e", version: "1.0.0" });
  await client.connect(transport);
  try {
    await run(client);
  } finally {
    await client.close();
  }
}

describe("When the MCP server runs against mock GitLab", () => {
  describe("with GITLAB_AUDIT_LOG enabled to a file", () => {
    it("should record one NDJSON line for a success and a failing tool call", async t => {
      const mockGitLab = await startMockGitLab();
      const directory = mkdtempSync(path.join(tmpdir(), "gitlab-mcp-audit-"));
      const auditFile = path.join(directory, "audit.ndjson");
      t.after(async () => {
        await mockGitLab.stop();
        rmSync(directory, { recursive: true, force: true });
      });

      const transport = createAuditTransport({
        apiUrl: `${mockGitLab.getUrl()}/api/v4`,
        auditLog: "true",
        auditLogFile: auditFile,
      });

      await withClient(transport, async client => {
        const success = await client.callTool({
          name: "get_project",
          arguments: {
            project_id: "123",
            token: SECRET_TOKEN,
            body: SECRET_BODY,
          },
        });
        assert.notEqual(success.isError, true);

        const failure = await client.callTool({
          name: "get_project",
          arguments: {
            project_id: MISSING_PROJECT_ID,
            token: SECRET_TOKEN,
            body: SECRET_BODY,
          },
        });
        assert.equal(failure.isError, true);

        const graphqlFailure = await client.callTool({
          name: "execute_graphql",
          arguments: {
            query: "query { currentUser { id } }",
            token: SECRET_TOKEN,
            body: SECRET_BODY,
          },
        });
        assert.notEqual(graphqlFailure.isError, true);
      });

      const raw = readFileSync(auditFile, "utf8");
      const records = readNdjson(auditFile);
      assert.equal(records.length, 3, raw);

      const successRecord = records.find(
        record => record.outcome === "success" && record.tool === "get_project"
      );
      const errorRecord = records.find(
        record => record.outcome === "error" && record.tool === "get_project"
      );
      const graphqlRecord = records.find(record => record.tool === "execute_graphql");
      assert.ok(successRecord, "missing success audit line");
      assert.ok(errorRecord, "missing error audit line");
      assert.ok(graphqlRecord, "missing graphql audit line");

      const lines = raw.trim().split("\n");
      assertSafeAuditRecord(successRecord, lines[records.indexOf(successRecord)] ?? raw);
      assertSafeAuditRecord(errorRecord, lines[records.indexOf(errorRecord)] ?? raw);
      assertSafeAuditRecord(graphqlRecord, lines[records.indexOf(graphqlRecord)] ?? raw);

      assert.equal(successRecord.tool, "get_project");
      assert.equal(successRecord.projectId, "123");
      assert.equal(successRecord.authMethod, "pat");
      assert.equal("errorClass" in successRecord, false);
      assert.equal("httpStatus" in successRecord, false);
      assert.equal("gitlabUserId" in successRecord, false);

      assert.equal(errorRecord.tool, "get_project");
      assert.equal(errorRecord.projectId, MISSING_PROJECT_ID);
      assert.equal(errorRecord.errorClass, "GitLabApiError");
      assert.equal(errorRecord.httpStatus, 404);

      assert.equal(graphqlRecord.outcome, "error");
      assert.equal(graphqlRecord.errorClass, "GitLabApiError");
      assert.equal(raw.includes("GraphQL request failed"), false);
    });
  });

  describe("with GITLAB_AUDIT_LOG disabled", () => {
    it("should not write the audit file even when a destination is set", async t => {
      const mockGitLab = await startMockGitLab();
      const directory = mkdtempSync(path.join(tmpdir(), "gitlab-mcp-audit-off-"));
      const auditFile = path.join(directory, "audit.ndjson");
      t.after(async () => {
        await mockGitLab.stop();
        rmSync(directory, { recursive: true, force: true });
      });

      const transport = createAuditTransport({
        apiUrl: `${mockGitLab.getUrl()}/api/v4`,
        auditLog: "false",
        auditLogFile: auditFile,
      });

      await withClient(transport, async client => {
        const success = await client.callTool({
          name: "get_project",
          arguments: {
            project_id: "123",
            token: SECRET_TOKEN,
            body: SECRET_BODY,
          },
        });
        assert.notEqual(success.isError, true);
      });

      assert.equal(existsSync(auditFile), false);
      assert.deepEqual(readNdjson(auditFile), []);
    });
  });
});
