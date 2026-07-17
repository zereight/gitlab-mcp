import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "456";
const TEST_VULNERABILITY_ID = "789";

const mockVulnerability = {
  id: 789,
  title: "Hard-coded credential detected",
  description: "A hard-coded credential was found in source code",
  state: "detected",
  severity: "critical",
  scanner: { name: "SECRET_DETECTION" },
  location: { file: "config/secrets.yml", start_line: 42, end_line: 42 },
  identifiers: [{ type: "cve", name: "CVE-2024-0001", value: "CVE-2024-0001" }],
  links: [{ name: "More info", url: "https://example.com/vuln/789" }],
  detected_at: "2024-06-01T10:00:00Z",
  dismissed_at: null,
  confirmed_at: null,
  resolved_at: null,
  dismissal_reason: null,
};

const mockVulnerabilityList = [
  mockVulnerability,
  {
    id: 790,
    title: "SQL Injection in login form",
    description: "Unsanitized input used in SQL query",
    state: "confirmed",
    severity: "high",
    scanner: { name: "SAST" },
    location: { file: "src/auth/login.ts", start_line: 18, end_line: 22 },
    identifiers: [{ type: "cwe", name: "CWE-89", value: "CWE-89" }],
    links: [],
    detected_at: "2024-06-02T08:00:00Z",
    dismissed_at: null,
    confirmed_at: "2024-06-03T09:00:00Z",
    resolved_at: null,
    dismissal_reason: null,
  },
  {
    id: 791,
    title: "Outdated dependency with known CVE",
    description: "Package foo@1.2.3 has a known vulnerability",
    state: "dismissed",
    severity: "medium",
    scanner: { name: "DAST" },
    location: { file: "package.json", start_line: 10, end_line: 10 },
    identifiers: [{ type: "cve", name: "CVE-2024-9999", value: "CVE-2024-9999" }],
    links: [{ name: "Advisory", url: "https://example.com/advisory/9999" }],
    detected_at: "2024-05-15T12:00:00Z",
    dismissed_at: "2024-05-20T14:00:00Z",
    confirmed_at: null,
    resolved_at: null,
    dismissal_reason: "acceptable_risk",
  },
];

async function callTool(
  toolName: string,
  args: Record<string, any>,
  env: NodeJS.ProcessEnv
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proc = spawn("node", ["build/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        USE_PIPELINE: "true",
      },
    });

    let output = "";
    let errorOutput = "";
    proc.stdout?.on("data", (d: Buffer) => (output += d));
    proc.stderr?.on("data", (d: Buffer) => (errorOutput += d));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }

      const line = output.split("\n").find((l) => l.startsWith("{"));
      if (!line) {
        return reject(new Error("No JSON output found"));
      }

      try {
        const response = JSON.parse(line);
        if (response.error) {
          reject(response.error);
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              resolve(JSON.parse(content));
            } catch {
              resolve(content);
            }
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        reject(e);
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

describe("vulnerability tools", () => {
  let mockGitLab: MockGitLabServer;
  let mockGitLabUrl: string;

  // Capture variables for verifying request bodies and query params
  let lastDismissBody: any = null;
  let lastConfirmBody: any = null;
  let lastListQueryParams: any = null;

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    // GET /projects/456/vulnerabilities - list with filter capture
    mockGitLab.addMockHandler("get", `/projects/${TEST_PROJECT_ID}/vulnerabilities`, (req, res) => {
      lastListQueryParams = { ...req.query };
      res.json(mockVulnerabilityList);
    });

    // GET /vulnerabilities/789 - single vulnerability detail
    mockGitLab.addMockHandler("get", `/vulnerabilities/${TEST_VULNERABILITY_ID}`, (req, res) => {
      res.json(mockVulnerability);
    });

    // POST /vulnerabilities/789/dismiss - dismiss with body capture
    mockGitLab.addMockHandler("post", `/vulnerabilities/${TEST_VULNERABILITY_ID}/dismiss`, (req, res) => {
      lastDismissBody = req.body;
      res.json({
        ...mockVulnerability,
        state: "dismissed",
        dismissed_at: "2024-06-10T12:00:00Z",
        dismissal_reason: req.body?.reason || "false_positive",
      });
    });

    // POST /vulnerabilities/789/confirm - confirm with body capture
    mockGitLab.addMockHandler("post", `/vulnerabilities/${TEST_VULNERABILITY_ID}/confirm`, (req, res) => {
      lastConfirmBody = req.body;
      res.json({
        ...mockVulnerability,
        state: "confirmed",
        confirmed_at: "2024-06-10T12:00:00Z",
      });
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("list_project_vulnerabilities returns array of vulnerabilities", async () => {
    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(Array.isArray(result), "Response should be an array");
    assert.strictEqual(result.length, 3, "Should return 3 vulnerabilities");
    assert.strictEqual(result[0].id, 789);
    assert.strictEqual(result[0].title, "Hard-coded credential detected");
  });

  test("list_project_vulnerabilities forwards state filter as query param", async () => {
    lastListQueryParams = null;

    await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, state: "detected" },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(lastListQueryParams, "Query params should have been captured");
    assert.strictEqual(lastListQueryParams.state, "detected", "state filter should be forwarded");
  });

  test("list_project_vulnerabilities forwards severity filter as query param", async () => {
    lastListQueryParams = null;

    await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, severity: "critical" },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(lastListQueryParams, "Query params should have been captured");
    assert.strictEqual(lastListQueryParams.severity, "critical", "severity filter should be forwarded");
  });

  test("list_project_vulnerabilities forwards scanner filter as query param", async () => {
    lastListQueryParams = null;

    await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, scanner: "SECRET_DETECTION" },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(lastListQueryParams, "Query params should have been captured");
    assert.strictEqual(lastListQueryParams.scanner, "SECRET_DETECTION", "scanner filter should be forwarded");
  });

  test("get_vulnerability returns full vulnerability object", async () => {
    const result = await callTool(
      "get_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.strictEqual(result.id, 789);
    assert.strictEqual(result.title, "Hard-coded credential detected");
    assert.strictEqual(result.description, "A hard-coded credential was found in source code");
    assert.strictEqual(result.state, "detected");
    assert.strictEqual(result.severity, "critical");
    assert.strictEqual(result.scanner.name, "SECRET_DETECTION");
    assert.strictEqual(result.location.file, "config/secrets.yml");
    assert.strictEqual(result.location.start_line, 42);
    assert.strictEqual(result.identifiers[0].name, "CVE-2024-0001");
    assert.strictEqual(result.links[0].url, "https://example.com/vuln/789");
  });

  test("dismiss_vulnerability sends correct POST body with reason", async () => {
    lastDismissBody = null;

    const result = await callTool(
      "dismiss_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID, reason: "false_positive" },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(lastDismissBody, "Request body should have been captured");
    assert.strictEqual(lastDismissBody.reason, "false_positive", "reason should be in request body");
    assert.strictEqual(result.state, "dismissed");
  });

  test("dismiss_vulnerability includes comment when provided", async () => {
    lastDismissBody = null;

    await callTool(
      "dismiss_vulnerability",
      {
        vulnerability_id: TEST_VULNERABILITY_ID,
        reason: "acceptable_risk",
        comment: "Reviewed by security team, risk accepted",
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(lastDismissBody, "Request body should have been captured");
    assert.strictEqual(lastDismissBody.reason, "acceptable_risk");
    assert.strictEqual(lastDismissBody.comment, "Reviewed by security team, risk accepted");
  });

  test("confirm_vulnerability sends POST to correct endpoint", async () => {
    lastConfirmBody = null;

    const result = await callTool(
      "confirm_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.strictEqual(result.state, "confirmed");
    assert.strictEqual(result.confirmed_at, "2024-06-10T12:00:00Z");
  });

  test("confirm_vulnerability includes comment when provided", async () => {
    lastConfirmBody = null;

    await callTool(
      "confirm_vulnerability",
      {
        vulnerability_id: TEST_VULNERABILITY_ID,
        comment: "Confirmed after manual verification",
      },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
      }
    );

    assert.ok(lastConfirmBody, "Request body should have been captured");
    assert.strictEqual(lastConfirmBody.comment, "Confirmed after manual verification");
  });

  // Read-only mode tests
  test("read-only mode: list_project_vulnerabilities succeeds", async () => {
    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
        GITLAB_PERMISSION_MODE: "readonly",
      }
    );

    assert.ok(Array.isArray(result), "Response should be an array in readonly mode");
    assert.strictEqual(result.length, 3);
  });

  test("read-only mode: get_vulnerability succeeds", async () => {
    const result = await callTool(
      "get_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID },
      {
        GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
        GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
        GITLAB_TOOLSETS: "vulnerabilities",
        GITLAB_PERMISSION_MODE: "readonly",
      }
    );

    assert.strictEqual(result.id, 789);
    assert.strictEqual(result.title, "Hard-coded credential detected");
  });

  test("read-only mode: dismiss_vulnerability is rejected", async () => {
    await assert.rejects(
      () =>
        callTool(
          "dismiss_vulnerability",
          { vulnerability_id: TEST_VULNERABILITY_ID, reason: "false_positive" },
          {
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
            GITLAB_TOOLSETS: "vulnerabilities",
            GITLAB_PERMISSION_MODE: "readonly",
          }
        ),
      (err: any) => {
        const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
        assert.ok(
          msg.toLowerCase().includes("not allowed") ||
            msg.toLowerCase().includes("read-only") ||
            msg.toLowerCase().includes("readonly") ||
            msg.toLowerCase().includes("not available"),
          `Expected read-only rejection, got: ${msg}`
        );
        return true;
      }
    );
  });

  test("read-only mode: confirm_vulnerability is rejected", async () => {
    await assert.rejects(
      () =>
        callTool(
          "confirm_vulnerability",
          { vulnerability_id: TEST_VULNERABILITY_ID },
          {
            GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
            GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
            GITLAB_TOOLSETS: "vulnerabilities",
            GITLAB_PERMISSION_MODE: "readonly",
          }
        ),
      (err: any) => {
        const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
        assert.ok(
          msg.toLowerCase().includes("not allowed") ||
            msg.toLowerCase().includes("read-only") ||
            msg.toLowerCase().includes("readonly") ||
            msg.toLowerCase().includes("not available"),
          `Expected read-only rejection, got: ${msg}`
        );
        return true;
      }
    );
  });
});
