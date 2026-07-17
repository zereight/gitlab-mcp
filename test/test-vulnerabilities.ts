import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";

const MOCK_TOKEN = "glpat-mock-token-12345";
const TEST_PROJECT_ID = "456";
const TEST_PROJECT_FULL_PATH = "test-group/test-project";
const TEST_VULNERABILITY_ID = "789";
const TEST_VULNERABILITY_GID = `gid://gitlab/Vulnerability/${TEST_VULNERABILITY_ID}`;

const mockVulnerability = {
  id: TEST_VULNERABILITY_GID,
  title: "Hard-coded credential detected",
  description: "A hard-coded credential was found in source code",
  state: "DETECTED",
  severity: "CRITICAL",
  reportType: "SECRET_DETECTION",
  detectedAt: "2024-06-01T10:00:00Z",
  confirmedAt: null,
  resolvedAt: null,
  dismissedAt: null,
  dismissalReason: null,
  webUrl: "https://gitlab.mock/test-group/test-project/-/security/vulnerabilities/789",
  scanner: { name: "GitLeaks", externalId: "gitleaks", vendor: "GitLab" },
  identifiers: [
    { externalType: "cve", externalId: "CVE-2024-0001", name: "CVE-2024-0001", url: null },
  ],
  links: [{ name: "More info", url: "https://example.com/vuln/789" }],
  location: { file: "config/secrets.yml", startLine: 42, endLine: 42 },
};

const mockVulnerabilityList = [
  mockVulnerability,
  {
    ...mockVulnerability,
    id: "gid://gitlab/Vulnerability/790",
    title: "SQL Injection in login form",
    state: "CONFIRMED",
    severity: "HIGH",
    reportType: "SAST",
    confirmedAt: "2024-06-03T09:00:00Z",
    location: { file: "src/auth/login.ts", startLine: 18, endLine: 22 },
  },
  {
    ...mockVulnerability,
    id: "gid://gitlab/Vulnerability/791",
    title: "Outdated dependency with known CVE",
    state: "DISMISSED",
    severity: "MEDIUM",
    reportType: "DEPENDENCY_SCANNING",
    dismissedAt: "2024-05-20T14:00:00Z",
    dismissalReason: "ACCEPTABLE_RISK",
    location: { file: "package.json", dependency: { package: { name: "foo" }, version: "1.2.3" } },
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

  // Capture variables for verifying GraphQL payloads
  let lastListVariables: any = null;
  let lastDismissInput: any = null;
  let lastConfirmInput: any = null;
  let lastGetId: any = null;

  const baseEnv = () => ({
    GITLAB_API_URL: `${mockGitLabUrl}/api/v4`,
    GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
    GITLAB_TOOLSETS: "vulnerabilities",
  });

  before(async () => {
    const mockPort = await findMockServerPort();
    mockGitLab = new MockGitLabServer({
      port: mockPort,
      validTokens: [MOCK_TOKEN],
    });

    // All four tools go through POST /api/graphql; dispatch on operation name
    mockGitLab.addRootHandler("post", "/api/graphql", (req, res) => {
      const query: string = req.body.query || "";
      const variables = req.body.variables || {};

      if (query.includes("vulnerabilityDismiss")) {
        lastDismissInput = variables.input;
        res.json({
          data: {
            vulnerabilityDismiss: {
              vulnerability: {
                id: TEST_VULNERABILITY_GID,
                state: "DISMISSED",
                dismissedAt: "2024-06-10T12:00:00Z",
                dismissalReason: variables.input?.dismissalReason || null,
              },
              errors: [],
            },
          },
        });
        return;
      }

      if (query.includes("vulnerabilityConfirm")) {
        lastConfirmInput = variables.input;
        res.json({
          data: {
            vulnerabilityConfirm: {
              vulnerability: {
                id: TEST_VULNERABILITY_GID,
                state: "CONFIRMED",
                confirmedAt: "2024-06-10T12:00:00Z",
              },
              errors: [],
            },
          },
        });
        return;
      }

      if (query.includes("listProjectVulnerabilities")) {
        lastListVariables = variables;
        let nodes = mockVulnerabilityList;
        if (variables.state) {
          nodes = nodes.filter(v => variables.state.includes(v.state));
        }
        if (variables.severity) {
          nodes = nodes.filter(v => variables.severity.includes(v.severity));
        }
        if (variables.reportType) {
          nodes = nodes.filter(v => variables.reportType.includes(v.reportType));
        }
        res.json({
          data: {
            project: {
              vulnerabilities: {
                nodes,
                pageInfo: { endCursor: "cursor-abc", hasNextPage: false },
              },
            },
          },
        });
        return;
      }

      if (query.includes("getVulnerability")) {
        lastGetId = variables.id;
        res.json({
          data: {
            vulnerability: {
              ...mockVulnerability,
              project: {
                id: "gid://gitlab/Project/456",
                name: "Test Project",
                fullPath: TEST_PROJECT_FULL_PATH,
              },
            },
          },
        });
        return;
      }

      res
        .status(400)
        .json({ errors: [{ message: `Unexpected GraphQL query: ${query.slice(0, 80)}` }] });
    });

    await mockGitLab.start();
    mockGitLabUrl = mockGitLab.getUrl();
  });

  after(async () => {
    await mockGitLab.stop();
  });

  test("list_project_vulnerabilities returns vulnerabilities with pageInfo", async () => {
    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID },
      baseEnv()
    );

    assert.ok(
      Array.isArray(result.vulnerabilities),
      "Response should contain vulnerabilities array"
    );
    assert.strictEqual(result.vulnerabilities.length, 3, "Should return 3 vulnerabilities");
    assert.strictEqual(result.vulnerabilities[0].id, TEST_VULNERABILITY_GID);
    assert.strictEqual(result.vulnerabilities[0].title, "Hard-coded credential detected");
    assert.ok(result.pageInfo, "Response should include pageInfo for cursor pagination");
    assert.strictEqual(result.pageInfo.hasNextPage, false);
  });

  test("list_project_vulnerabilities resolves numeric project ID to full path", async () => {
    lastListVariables = null;

    await callTool("list_project_vulnerabilities", { project_id: TEST_PROJECT_ID }, baseEnv());

    assert.ok(lastListVariables, "GraphQL variables should have been captured");
    assert.strictEqual(
      lastListVariables.fullPath,
      TEST_PROJECT_FULL_PATH,
      "Numeric project ID should be resolved to the project full path"
    );
  });

  test("list_project_vulnerabilities passes state filter as GraphQL enum", async () => {
    lastListVariables = null;

    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, state: "detected" },
      baseEnv()
    );

    assert.ok(lastListVariables, "GraphQL variables should have been captured");
    assert.deepStrictEqual(
      lastListVariables.state,
      ["DETECTED"],
      "state should be uppercased enum array"
    );
    assert.strictEqual(result.vulnerabilities.length, 1, "Mock should filter to only DETECTED");
  });

  test("list_project_vulnerabilities passes severity filter as GraphQL enum", async () => {
    lastListVariables = null;

    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, severity: "critical" },
      baseEnv()
    );

    assert.ok(lastListVariables, "GraphQL variables should have been captured");
    assert.deepStrictEqual(lastListVariables.severity, ["CRITICAL"]);
    assert.strictEqual(result.vulnerabilities.length, 1, "Mock should filter to only CRITICAL");
  });

  test("list_project_vulnerabilities passes report_type filter as GraphQL enum", async () => {
    lastListVariables = null;

    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, report_type: "secret_detection" },
      baseEnv()
    );

    assert.ok(lastListVariables, "GraphQL variables should have been captured");
    assert.deepStrictEqual(lastListVariables.reportType, ["SECRET_DETECTION"]);
    assert.strictEqual(
      result.vulnerabilities.length,
      1,
      "Mock should filter to only SECRET_DETECTION"
    );
  });

  test("list_project_vulnerabilities forwards cursor pagination", async () => {
    lastListVariables = null;

    await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID, first: 50, after: "cursor-abc" },
      baseEnv()
    );

    assert.ok(lastListVariables, "GraphQL variables should have been captured");
    assert.strictEqual(lastListVariables.first, 50);
    assert.strictEqual(lastListVariables.after, "cursor-abc");
  });

  test("get_vulnerability returns full vulnerability object via GID", async () => {
    lastGetId = null;

    const result = await callTool(
      "get_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID },
      baseEnv()
    );

    assert.strictEqual(
      lastGetId,
      TEST_VULNERABILITY_GID,
      "Numeric ID should be converted to a GraphQL global ID"
    );
    assert.strictEqual(result.id, TEST_VULNERABILITY_GID);
    assert.strictEqual(result.title, "Hard-coded credential detected");
    assert.strictEqual(result.description, "A hard-coded credential was found in source code");
    assert.strictEqual(result.state, "DETECTED");
    assert.strictEqual(result.severity, "CRITICAL");
    assert.strictEqual(result.reportType, "SECRET_DETECTION");
    assert.strictEqual(result.location.file, "config/secrets.yml");
    assert.strictEqual(result.location.startLine, 42);
    assert.strictEqual(result.identifiers[0].name, "CVE-2024-0001");
    assert.strictEqual(result.links[0].url, "https://example.com/vuln/789");
    assert.strictEqual(result.project.fullPath, TEST_PROJECT_FULL_PATH);
  });

  test("dismiss_vulnerability sends dismissalReason in mutation input", async () => {
    lastDismissInput = null;

    const result = await callTool(
      "dismiss_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID, reason: "false_positive" },
      baseEnv()
    );

    assert.ok(lastDismissInput, "Mutation input should have been captured");
    assert.strictEqual(lastDismissInput.id, TEST_VULNERABILITY_GID);
    assert.strictEqual(
      lastDismissInput.dismissalReason,
      "FALSE_POSITIVE",
      "Reason should be mapped to the GraphQL enum"
    );
    assert.strictEqual(result.state, "DISMISSED");
    assert.strictEqual(result.dismissalReason, "FALSE_POSITIVE");
  });

  test("dismiss_vulnerability includes comment when provided", async () => {
    lastDismissInput = null;

    await callTool(
      "dismiss_vulnerability",
      {
        vulnerability_id: TEST_VULNERABILITY_ID,
        reason: "acceptable_risk",
        comment: "Reviewed by security team, risk accepted",
      },
      baseEnv()
    );

    assert.ok(lastDismissInput, "Mutation input should have been captured");
    assert.strictEqual(lastDismissInput.dismissalReason, "ACCEPTABLE_RISK");
    assert.strictEqual(lastDismissInput.comment, "Reviewed by security team, risk accepted");
  });

  test("dismiss_vulnerability accepts mitigating_control and not_applicable reasons", async () => {
    lastDismissInput = null;
    await callTool(
      "dismiss_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID, reason: "mitigating_control" },
      baseEnv()
    );
    assert.strictEqual(lastDismissInput.dismissalReason, "MITIGATING_CONTROL");

    lastDismissInput = null;
    await callTool(
      "dismiss_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID, reason: "not_applicable" },
      baseEnv()
    );
    assert.strictEqual(lastDismissInput.dismissalReason, "NOT_APPLICABLE");
  });

  test("confirm_vulnerability sends mutation with GID", async () => {
    lastConfirmInput = null;

    const result = await callTool(
      "confirm_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID },
      baseEnv()
    );

    assert.ok(lastConfirmInput, "Mutation input should have been captured");
    assert.strictEqual(lastConfirmInput.id, TEST_VULNERABILITY_GID);
    assert.strictEqual(result.state, "CONFIRMED");
    assert.strictEqual(result.confirmedAt, "2024-06-10T12:00:00Z");
  });

  test("confirm_vulnerability includes comment when provided", async () => {
    lastConfirmInput = null;

    await callTool(
      "confirm_vulnerability",
      {
        vulnerability_id: TEST_VULNERABILITY_ID,
        comment: "Confirmed after manual verification",
      },
      baseEnv()
    );

    assert.ok(lastConfirmInput, "Mutation input should have been captured");
    assert.strictEqual(lastConfirmInput.comment, "Confirmed after manual verification");
  });

  // Read-only mode tests
  test("read-only mode: list_project_vulnerabilities succeeds", async () => {
    const result = await callTool(
      "list_project_vulnerabilities",
      { project_id: TEST_PROJECT_ID },
      { ...baseEnv(), GITLAB_PERMISSION_MODE: "readonly" }
    );

    assert.ok(
      Array.isArray(result.vulnerabilities),
      "Should return vulnerabilities in readonly mode"
    );
    assert.strictEqual(result.vulnerabilities.length, 3);
  });

  test("read-only mode: get_vulnerability succeeds", async () => {
    const result = await callTool(
      "get_vulnerability",
      { vulnerability_id: TEST_VULNERABILITY_ID },
      { ...baseEnv(), GITLAB_PERMISSION_MODE: "readonly" }
    );

    assert.strictEqual(result.id, TEST_VULNERABILITY_GID);
    assert.strictEqual(result.title, "Hard-coded credential detected");
  });

  test("read-only mode: dismiss_vulnerability is rejected", async () => {
    await assert.rejects(
      () =>
        callTool(
          "dismiss_vulnerability",
          { vulnerability_id: TEST_VULNERABILITY_ID, reason: "false_positive" },
          { ...baseEnv(), GITLAB_PERMISSION_MODE: "readonly" }
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
          { ...baseEnv(), GITLAB_PERMISSION_MODE: "readonly" }
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
