/**
 * CI lint under a project allowlist. GitLab expands `include:` entries with the token's
 * permissions, so a lint result can carry files from other projects. Under an allowlist,
 * validate_ci_lint and validate_project_ci_lint keep the verdict but drop merged_yaml,
 * includes, and jobs when an include reads from a project outside it.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import { MockGitLabServer, findMockServerPort } from "./utils/mock-gitlab-server.js";
import { StdioTestClient } from "./clients/stdio-client.js";

const MOCK_TOKEN = "glpat-ci-lint-scope-test-token";
const PRIVATE_CONTENT = "OUT-OF-SCOPE-PRIVATE-SCRIPT-7731";
const ALLOWED_PATH = "group/allowed";

interface Outcome {
  isError: boolean;
  text: string;
}

function lintResponse(includes: unknown[]) {
  return {
    valid: true,
    errors: [],
    warnings: ["a warning"],
    merged_yaml: `job:\n  script: echo ${PRIVATE_CONTENT}\n`,
    includes,
    jobs: [{ name: "job", stage: "test", script: [`echo ${PRIVATE_CONTENT}`] }],
  };
}

const LOCAL_INCLUDE = {
  type: "local",
  location: "ci/local.yml",
  extra: {},
  context_project: ALLOWED_PATH,
};
const OTHER_PROJECT_FILE = {
  type: "file",
  location: ".gitlab-ci.yml",
  extra: { project: "other/private", ref: "main" },
  context_project: ALLOWED_PATH,
};
const NESTED_LOCAL_IN_OTHER_PROJECT = {
  type: "local",
  location: "nested.yml",
  extra: {},
  context_project: "other/private",
};
const ALLOWED_PROJECT_FILE = {
  type: "file",
  location: "templates/build.yml",
  extra: { project: ALLOWED_PATH, ref: "main" },
  context_project: ALLOWED_PATH,
};
const TEMPLATE_INCLUDE = {
  type: "template",
  location: "Jobs/SAST.gitlab-ci.yml",
  extra: {},
  context_project: ALLOWED_PATH,
};
const OTHER_COMPONENT = {
  type: "component",
  location: "gitlab.example.com/other/components/build@1.0.0",
  extra: {},
  context_project: ALLOWED_PATH,
};
const ALLOWED_COMPONENT = {
  type: "component",
  location: `gitlab.example.com/${ALLOWED_PATH}/build@1.0.0`,
  extra: {},
  context_project: ALLOWED_PATH,
};
const UNKNOWN_TYPE = {
  type: "artifact",
  location: "generated.yml",
  extra: {},
  context_project: ALLOWED_PATH,
};

describe("CI lint project scope", () => {
  let mockGitLab: MockGitLabServer;
  let apiUrl: string;
  let nextIncludes: unknown[] = [];
  const clients: StdioTestClient[] = [];

  before(async () => {
    mockGitLab = new MockGitLabServer({
      port: await findMockServerPort(),
      validTokens: [MOCK_TOKEN],
    });
    for (const projectRef of ["123", encodeURIComponent(ALLOWED_PATH)]) {
      mockGitLab.addMockHandler("post", `/projects/${projectRef}/ci/lint`, (_req, res) => {
        res.json(lintResponse(nextIncludes));
      });
      mockGitLab.addMockHandler("get", `/projects/${projectRef}/ci/lint`, (_req, res) => {
        res.json(lintResponse(nextIncludes));
      });
    }
    // Numeric allowlist entries resolve include paths to project IDs.
    mockGitLab.addMockHandler(
      "get",
      `/projects/${encodeURIComponent(ALLOWED_PATH)}`,
      (_req, res) => {
        res.json({ id: 123, path_with_namespace: ALLOWED_PATH });
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${encodeURIComponent("other/private")}`,
      (_req, res) => {
        res.json({ id: 999, path_with_namespace: "other/private" });
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${encodeURIComponent("other/components")}`,
      (_req, res) => {
        res.json({ id: 555, path_with_namespace: "other/components" });
      }
    );
    // Lookups that fail: an error status and a body that is not JSON.
    mockGitLab.addMockHandler(
      "get",
      `/projects/${encodeURIComponent("broken/status")}`,
      (_req, res) => {
        res.status(500).json({ message: "500 Internal Server Error" });
      }
    );
    mockGitLab.addMockHandler(
      "get",
      `/projects/${encodeURIComponent("broken/body")}`,
      (_req, res) => {
        res.status(200).type("application/json").send("not json");
      }
    );
    await mockGitLab.start();
    apiUrl = `${mockGitLab.getUrl()}/api/v4`;
  });

  after(async () => {
    for (const client of clients) {
      await client.disconnect();
    }
    await mockGitLab.stop();
  });

  async function connect(allowedProjectIds: string): Promise<StdioTestClient> {
    const client = new StdioTestClient();
    await client.connect("build/index.js", {
      GITLAB_API_URL: apiUrl,
      GITLAB_PERSONAL_ACCESS_TOKEN: MOCK_TOKEN,
      GITLAB_TOOLSETS: "ci",
      GITLAB_PROJECT_ID: "",
      GITLAB_ALLOWED_PROJECT_IDS: allowedProjectIds,
      ENABLE_STRICT_PROJECT_SCOPE: "false",
      GITLAB_DISABLE_VERSION_CHECK: "true",
    });
    clients.push(client);
    return client;
  }

  async function lint(
    client: StdioTestClient,
    tool: "validate_ci_lint" | "validate_project_ci_lint",
    projectId: string,
    includes: unknown[]
  ): Promise<Outcome> {
    nextIncludes = includes;
    const args =
      tool === "validate_ci_lint"
        ? { project_id: projectId, content: "include: []", include_jobs: true }
        : { project_id: projectId, include_jobs: true };
    const result = await client.callTool(tool, args);
    const text = (result.content as Array<{ text?: string }>).map(part => part.text ?? "").join("");
    return { isError: result.isError === true, text };
  }

  function assertStripped(outcome: Outcome): void {
    assert.strictEqual(outcome.isError, false, outcome.text);
    assert.ok(!outcome.text.includes(PRIVATE_CONTENT), outcome.text);
    const parsed = JSON.parse(outcome.text);
    assert.strictEqual(parsed.valid, true);
    assert.deepStrictEqual(parsed.errors, []);
    assert.deepStrictEqual(parsed.warnings, ["a warning"]);
    assert.strictEqual(parsed.merged_yaml, null);
    assert.strictEqual(parsed.includes, null);
    assert.strictEqual(parsed.jobs, undefined);
    assert.match(parsed.scope_note, /outside the allowed project list/);
  }

  function assertKept(outcome: Outcome): void {
    assert.strictEqual(outcome.isError, false, outcome.text);
    const parsed = JSON.parse(outcome.text);
    assert.ok(parsed.merged_yaml.includes(PRIVATE_CONTENT), outcome.text);
    assert.strictEqual(parsed.jobs[0].name, "job");
    assert.strictEqual(parsed.scope_note, undefined);
  }

  test("without an allowlist the lint result is unchanged", async () => {
    const client = await connect("");
    assertKept(await lint(client, "validate_ci_lint", "123", [OTHER_PROJECT_FILE]));
  });

  test("an include: project: file from a project outside the allowlist is dropped", async () => {
    const client = await connect("123");
    assertStripped(
      await lint(client, "validate_ci_lint", "123", [LOCAL_INCLUDE, OTHER_PROJECT_FILE])
    );
    assertStripped(await lint(client, "validate_project_ci_lint", "123", [OTHER_PROJECT_FILE]));
  });

  test("a nested local include inside another project's file is dropped", async () => {
    const client = await connect("123");
    assertStripped(
      await lint(client, "validate_ci_lint", "123", [LOCAL_INCLUDE, NESTED_LOCAL_IN_OTHER_PROJECT])
    );
  });

  test("a component from a project outside the allowlist, or an unknown include type, is dropped", async () => {
    const client = await connect("123");
    assertStripped(await lint(client, "validate_ci_lint", "123", [OTHER_COMPONENT]));
    assertStripped(await lint(client, "validate_ci_lint", "123", [UNKNOWN_TYPE]));
  });

  test("a project lookup that fails keeps the verdict and drops the expanded configuration", async () => {
    const client = await connect("123");
    for (const project of ["broken/status", "broken/body"]) {
      assertStripped(
        await lint(client, "validate_ci_lint", "123", [
          { ...OTHER_PROJECT_FILE, extra: { project, ref: "main" } },
        ])
      );
    }
  });

  test("includes from the allowed project are kept with a numeric allowlist", async () => {
    const client = await connect("123");
    assertKept(
      await lint(client, "validate_ci_lint", "123", [
        LOCAL_INCLUDE,
        ALLOWED_PROJECT_FILE,
        TEMPLATE_INCLUDE,
        ALLOWED_COMPONENT,
      ])
    );
    assertKept(await lint(client, "validate_project_ci_lint", "123", [LOCAL_INCLUDE]));
  });

  test("includes from the allowed project are kept with a path allowlist", async () => {
    const client = await connect(ALLOWED_PATH);
    assertKept(
      await lint(client, "validate_ci_lint", ALLOWED_PATH, [LOCAL_INCLUDE, ALLOWED_PROJECT_FILE])
    );
    assertStripped(await lint(client, "validate_ci_lint", ALLOWED_PATH, [OTHER_PROJECT_FILE]));
  });
});
