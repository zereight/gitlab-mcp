/**
 * Live E2E for project scope on the CI/CD catalog, namespace, and project code
 * search tools. It talks to the MCP server over stdio in readonly mode and reads
 * a public CI/CD catalog resource (components/sast on gitlab.com by default) that
 * is never in the test project's allowlist:
 *
 * - get_ci_catalog_resource, by full_path and by id, is refused when the allowlist
 *   holds only the test project, and works when the allowlist holds the catalog
 *   project by path or by numeric ID.
 * - Under ENABLE_STRICT_PROJECT_SCOPE with an allowlist, list_ci_catalog_resources,
 *   list_namespaces, get_namespace, and verify_namespace are refused.
 * - search_project_code with an empty project_id searches the single allowed
 *   project, not the whole instance.
 *
 * It creates nothing, so there is nothing to clean up. Skips without a token or a
 * project ID. The project comes from TEST_PROJECT_ID, or from GITLAB_PROJECT_ID.
 * E2E_CATALOG_PATH overrides the catalog project.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert";
import dotenv from "dotenv";
import { StdioTestClient } from "../clients/stdio-client.js";
import { normalizeGitLabApiUrl } from "../../utils/url.js";
import { callToolWithBackoff } from "./rate-limit.js";

dotenv.config();

const GITLAB_TOKEN =
  process.env.GITLAB_TOKEN_TEST ||
  process.env.GITLAB_TOKEN ||
  process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || process.env.GITLAB_PROJECT_ID;
const GITLAB_API_URL = normalizeGitLabApiUrl(process.env.GITLAB_API_URL || "https://gitlab.com");
const CATALOG_PATH = process.env.E2E_CATALOG_PATH || "components/sast";

const SKIP_REASON = !GITLAB_TOKEN
  ? "no GitLab token; set GITLAB_TOKEN_TEST, GITLAB_TOKEN, or GITLAB_PERSONAL_ACCESS_TOKEN"
  : !TEST_PROJECT_ID
    ? "no test project; set TEST_PROJECT_ID (or GITLAB_PROJECT_ID)"
    : false;

interface ToolOutcome {
  isError: boolean;
  text: string;
}

async function connect(env: Record<string, string>): Promise<StdioTestClient> {
  const client = new StdioTestClient();
  // The runner's own scope variables are inherited, so every scope setting is explicit.
  await client.connect("build/index.js", {
    GITLAB_PERSONAL_ACCESS_TOKEN: GITLAB_TOKEN ?? "",
    GITLAB_API_URL,
    GITLAB_TOOLSETS: "all",
    GITLAB_PERMISSION_MODE: "readonly",
    GITLAB_PROJECT_ID: "",
    GITLAB_ALLOWED_PROJECT_IDS: "",
    ENABLE_STRICT_PROJECT_SCOPE: "false",
    GITLAB_DISABLE_VERSION_CHECK: "true",
    ...env,
  });
  return client;
}

async function call(
  client: StdioTestClient,
  name: string,
  args: Record<string, unknown>
): Promise<ToolOutcome> {
  try {
    const result = await callToolWithBackoff(client, name, args);
    const text = (result.content as Array<{ text?: string }>)
      .map(part => part.text ?? "")
      .join("\n");
    return { isError: result.isError === true, text };
  } catch (error) {
    return { isError: true, text: error instanceof Error ? error.message : String(error) };
  }
}

function catalogResource(outcome: ToolOutcome): { id?: string; fullPath?: string } | null {
  assert.strictEqual(outcome.isError, false, outcome.text);
  const parsed = JSON.parse(outcome.text);
  return parsed?.data?.ciCatalogResource ?? null;
}

describe(
  "live: CI/CD catalog, namespace, and code search project scope",
  { skip: SKIP_REASON },
  () => {
    const clients: StdioTestClient[] = [];
    let catalogId = "";
    let catalogProjectId = "";
    let testNamespace = "";

    async function open(env: Record<string, string>): Promise<StdioTestClient> {
      const client = await connect(env);
      clients.push(client);
      return client;
    }

    before(async () => {
      const unscoped = await open({});
      const resource = catalogResource(
        await call(unscoped, "get_ci_catalog_resource", { full_path: CATALOG_PATH })
      );
      assert.ok(resource?.id, `${CATALOG_PATH} should be a CI/CD catalog resource`);
      assert.strictEqual(resource.fullPath, CATALOG_PATH);
      catalogId = resource.id;

      const project = await call(unscoped, "get_project", { project_id: CATALOG_PATH });
      assert.strictEqual(project.isError, false, project.text);
      catalogProjectId = String(JSON.parse(project.text).id);
      assert.match(catalogProjectId, /^\d+$/);
      assert.notStrictEqual(catalogProjectId, String(TEST_PROJECT_ID));

      // The namespace tools read the test project's own namespace, which the token can see.
      const testProject = await call(unscoped, "get_project", {
        project_id: String(TEST_PROJECT_ID),
      });
      assert.strictEqual(testProject.isError, false, testProject.text);
      testNamespace = JSON.parse(testProject.text).namespace?.full_path ?? "";
      assert.ok(testNamespace, "the test project should report its namespace");
    });

    after(async () => {
      for (const client of clients) {
        await client.disconnect();
      }
    });

    test("a catalog project outside the allowlist is refused by full_path and by id", async () => {
      const scoped = await open({ GITLAB_ALLOWED_PROJECT_IDS: String(TEST_PROJECT_ID) });

      for (const args of [
        { full_path: CATALOG_PATH, include_readme: true },
        { id: catalogId, include_readme: true },
      ]) {
        const outcome = await call(scoped, "get_ci_catalog_resource", args);
        assert.strictEqual(outcome.isError, true, `expected a refusal, got: ${outcome.text}`);
        assert.match(outcome.text, /Access denied/, outcome.text);
        assert.doesNotMatch(outcome.text, /ciCatalogResource|readmeHtml|versions/, outcome.text);
      }
    });

    test("the catalog project works when the allowlist holds its path", async () => {
      const scoped = await open({ GITLAB_ALLOWED_PROJECT_IDS: CATALOG_PATH });
      const byPath = catalogResource(
        await call(scoped, "get_ci_catalog_resource", { full_path: CATALOG_PATH })
      );
      assert.strictEqual(byPath?.fullPath, CATALOG_PATH);
      const byId = catalogResource(
        await call(scoped, "get_ci_catalog_resource", { id: catalogId })
      );
      assert.strictEqual(byId?.fullPath, CATALOG_PATH);
    });

    test("the catalog project works when the allowlist holds its numeric ID", async () => {
      const scoped = await open({ GITLAB_ALLOWED_PROJECT_IDS: catalogProjectId });
      const byPath = catalogResource(
        await call(scoped, "get_ci_catalog_resource", { full_path: CATALOG_PATH })
      );
      assert.strictEqual(byPath?.fullPath, CATALOG_PATH);
      const byId = catalogResource(
        await call(scoped, "get_ci_catalog_resource", { id: catalogId })
      );
      assert.strictEqual(byId?.fullPath, CATALOG_PATH);
    });

    test("strict scope refuses the catalog listing and the namespace tools", async () => {
      const namespace = testNamespace;
      const calls: Array<[string, Record<string, unknown>]> = [
        ["list_ci_catalog_resources", {}],
        ["list_namespaces", {}],
        ["get_namespace", { namespace_id: namespace }],
        ["verify_namespace", { path: namespace }],
      ];

      const strict = await open({
        GITLAB_ALLOWED_PROJECT_IDS: String(TEST_PROJECT_ID),
        ENABLE_STRICT_PROJECT_SCOPE: "true",
      });
      for (const [name, args] of calls) {
        const outcome = await call(strict, name, args);
        assert.strictEqual(
          outcome.isError,
          true,
          `${name} should be refused, got: ${outcome.text}`
        );
        assert.match(
          outcome.text,
          /not allowed while a project allowlist is in effect/,
          outcome.text
        );
      }

      // Without strict mode the same calls are still served.
      const loose = await open({ GITLAB_ALLOWED_PROJECT_IDS: String(TEST_PROJECT_ID) });
      for (const [name, args] of calls) {
        const outcome = await call(loose, name, args);
        assert.strictEqual(outcome.isError, false, `${name} without strict: ${outcome.text}`);
      }
    });

    test("search_project_code with an empty project_id stays in the allowed project", async () => {
      const strict = await open({
        GITLAB_ALLOWED_PROJECT_IDS: String(TEST_PROJECT_ID),
        ENABLE_STRICT_PROJECT_SCOPE: "true",
      });
      const outcome = await call(strict, "search_project_code", { project_id: "", search: "e2e" });
      assert.strictEqual(outcome.isError, false, outcome.text);
      const results = JSON.parse(outcome.text) as Array<{ project_id: number }>;
      assert.ok(Array.isArray(results) && results.length > 0, outcome.text);
      for (const result of results) {
        assert.strictEqual(String(result.project_id), String(TEST_PROJECT_ID));
      }

      // With several allowed projects and no default, an empty project_id is an input error.
      const several = await open({
        GITLAB_ALLOWED_PROJECT_IDS: `${TEST_PROJECT_ID},${catalogProjectId}`,
      });
      const ambiguous = await call(several, "search_project_code", {
        project_id: "",
        search: "e2e",
      });
      assert.strictEqual(ambiguous.isError, true, ambiguous.text);
      assert.doesNotMatch(ambiguous.text, /403/, ambiguous.text);
    });
  }
);
