import { after, before, describe, test } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-tags";
const TEST_PROJECT_ID = "123";
const TEST_TAG_NAME = "v1.0.0";

function buildTag(overrides: Record<string, unknown> = {}) {
  return {
    name: TEST_TAG_NAME,
    message: "Annotated release tag",
    target: "abc123def4567890",
    commit: {
      id: "abc123def4567890",
      short_id: "abc123de",
      title: "Release v1.0.0",
      created_at: "2026-03-13T10:00:00.000Z",
      parent_ids: ["1111111111111111"],
      message: "Release v1.0.0",
      author_name: "Test User",
      author_email: "test@example.com",
      authored_date: "2026-03-13T09:55:00.000Z",
      committer_name: "Test User",
      committer_email: "test@example.com",
      committed_date: "2026-03-13T10:00:00.000Z",
    },
    release: {
      tag_name: TEST_TAG_NAME,
      description: "Release notes",
    },
    protected: false,
    created_at: "2026-03-13T10:00:00.000Z",
    ...overrides,
  };
}

async function callTool(
  toolName: string,
  args: Record<string, unknown>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find(l => l.startsWith("{"));
      if (!line) {
        return reject(new Error("No JSON output found"));
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
          return;
        }

        const content = response.result?.content?.[0]?.text;
        if (!content) {
          resolve(response.result);
          return;
        }

        try {
          resolve(JSON.parse(content));
        } catch {
          resolve(content);
        }
      } catch (error) {
        reject(error);
      }
    });

    proc.stdin?.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }) + "\n"
    );
  });
}

describe("tag tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  before(async () => {
    const mockPort = await findMockServerPort(20000, 50);
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/repository/tags`, (req, res) => {
      assert.strictEqual(req.query.search, "^v");
      assert.strictEqual(req.query.order_by, "version");
      assert.strictEqual(req.query.sort, "desc");
      assert.strictEqual(req.query.page, "2");
      assert.strictEqual(req.query.per_page, "10");
      res.json([buildTag()]);
    });

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/tags/${encodeURIComponent(TEST_TAG_NAME)}`,
      (_req, res) => {
        res.json(buildTag());
      }
    );

    mockGitLab.addMockHandler(
      "post",
      `/projects/${TEST_PROJECT_ID}/repository/tags`,
      (req, res) => {
        assert.deepStrictEqual(req.body, {
          tag_name: TEST_TAG_NAME,
          ref: "main",
          message: "Release tag",
        });
        res.json(buildTag({ created_at: null }));
      }
    );

    mockGitLab.addMockHandler(
      "delete",
      `/projects/${TEST_PROJECT_ID}/repository/tags/${encodeURIComponent(TEST_TAG_NAME)}`,
      (_req, res) => {
        res.status(204).send();
      }
    );

    mockGitLab.addMockHandler(
      "get",
      `/projects/${TEST_PROJECT_ID}/repository/tags/${encodeURIComponent(TEST_TAG_NAME)}/signature`,
      (_req, res) => {
        res.json({
          signature_type: "X509",
          verification_status: "unverified",
          x509_certificate: {
            id: 1,
            subject: "CN=Test User,O=Example",
            subject_key_identifier: "A1725E379E7B25B2",
            email: null,
            serial_number: 123456789,
            certificate_status: "good",
            x509_issuer: {
              id: 1,
              subject: "CN=Example CA,O=Example",
              subject_key_identifier: "C6411E6F5B9E2CFD",
              crl_url: null,
            },
          },
        });
      }
    );

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  const env = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "tags",
  });

  test("list_tags returns parsed tags with query filters", async () => {
    const result = await callTool(
      "list_tags",
      {
        project_id: TEST_PROJECT_ID,
        search: "^v",
        order_by: "version",
        sort: "desc",
        page: 2,
        per_page: 10,
      },
      env()
    );

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, TEST_TAG_NAME);
  });

  test("get_tag returns a single tag", async () => {
    const result = await callTool(
      "get_tag",
      { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
      env()
    );

    assert.strictEqual(result.name, TEST_TAG_NAME);
    assert.strictEqual(result.commit.short_id, "abc123de");
  });

  test("create_tag posts the expected payload", async () => {
    const result = await callTool(
      "create_tag",
      {
        project_id: TEST_PROJECT_ID,
        tag_name: TEST_TAG_NAME,
        ref: "main",
        message: "Release tag",
      },
      env()
    );

    assert.strictEqual(result.name, TEST_TAG_NAME);
    assert.strictEqual(result.release.description, "Release notes");
    assert.strictEqual(result.created_at, null);
  });

  test("delete_tag returns a success payload", async () => {
    const result = await callTool(
      "delete_tag",
      { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
      env()
    );

    assert.deepStrictEqual(result, {
      status: "success",
      message: `Tag '${TEST_TAG_NAME}' deleted successfully`,
    });
  });

  test("get_tag_signature returns signature data", async () => {
    const result = await callTool(
      "get_tag_signature",
      { project_id: TEST_PROJECT_ID, tag_name: TEST_TAG_NAME },
      env()
    );

    assert.deepStrictEqual(result, {
      signature_type: "X509",
      verification_status: "unverified",
      x509_certificate: {
        id: 1,
        subject: "CN=Test User,O=Example",
        subject_key_identifier: "A1725E379E7B25B2",
        email: null,
        serial_number: 123456789,
        certificate_status: "good",
        x509_issuer: {
          id: 1,
          subject: "CN=Example CA,O=Example",
          subject_key_identifier: "C6411E6F5B9E2CFD",
          crl_url: null,
        },
      },
    });
  });
});
