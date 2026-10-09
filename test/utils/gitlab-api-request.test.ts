import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isToolExposed } from "../../cli/exposure.js";
import { selectExposedTools } from "../../tools/exposed-tools.js";
import {
  advertisesReadOnly,
  allTools,
  deleteTools,
  destructiveTools,
  DISCOVERABLE_TOOLSET_IDS,
  isExplicitToolsetOnlyTool,
  listDiscoverableCategories,
  parseEnabledToolsets,
  readOnlyTools,
} from "../../tools/registry.js";
import {
  assertGitLabApiRequestMethodAllowed,
  executeGitLabApiRequestAsync,
  GitLabApiRequestHttpError,
  GitLabApiRequestInputError,
} from "../../tools/gitlab-api-request.js";
import { resolveGitLabApiRequestUrl } from "../../utils/url.js";

const API_BASE = "http://127.0.0.1:9/api/v4";

function resolveOrThrow(path: string): URL {
  return resolveGitLabApiRequestUrl(API_BASE, path);
}

describe("When resolving a gitlab_api_request path", () => {
  describe("with a normal relative path", () => {
    it("should stay under the configured /api/v4 origin", () => {
      const resolved = resolveOrThrow("/projects/1/issues");

      assert.equal(resolved.href, "http://127.0.0.1:9/api/v4/projects/1/issues");
    });
  });

  describe("with an absolute URL", () => {
    it("should reject the path", () => {
      assert.throws(() => resolveOrThrow("https://evil.example/api/v4/user"), /relative path/);
    });
  });

  describe("with a protocol-relative host", () => {
    it("should reject the path", () => {
      assert.throws(() => resolveOrThrow("//evil.example/projects/1"), /relative path/);
    });
  });

  describe("with a parent segment", () => {
    it("should reject the path", () => {
      assert.throws(() => resolveOrThrow("projects/../secrets"), /path segment/);
    });
  });

  describe("with an encoded parent segment", () => {
    it("should reject the path", () => {
      assert.throws(() => resolveOrThrow("projects/%2e%2e/secrets"), /path segment/);
    });
  });

  describe("with a backslash", () => {
    it("should reject the path", () => {
      assert.throws(() => resolveOrThrow("projects\\1"), /relative path/);
    });
  });
});

describe("When classifying gitlab_api_request", () => {
  describe("with the registry sets", () => {
    it("should stay listed for readonly GET while advertising a destructive write", () => {
      assert.equal(readOnlyTools.has("gitlab_api_request"), true);
      assert.equal(advertisesReadOnly("gitlab_api_request"), false);
      assert.equal(destructiveTools.has("gitlab_api_request"), true);
      assert.equal(deleteTools.has("gitlab_api_request"), false);
    });
  });
});

describe("When enabling toolsets", () => {
  describe("with GITLAB_TOOLSETS=all", () => {
    it("should omit the api toolset", () => {
      assert.equal(parseEnabledToolsets("all").has("api"), false);
      assert.equal(DISCOVERABLE_TOOLSET_IDS.has("api"), false);
    });
  });

  describe("with GITLAB_TOOLSETS=api", () => {
    it("should include the api toolset", () => {
      assert.equal(parseEnabledToolsets("api").has("api"), true);
    });
  });

  describe("with discover_tools categories", () => {
    it("should hide api", () => {
      const ids = listDiscoverableCategories(new Set()).map(category => category.id);

      assert.equal(ids.includes("api"), false);
    });
  });

  describe("with GITLAB_TOOLS naming gitlab_api_request", () => {
    it("should not expose the tool", () => {
      const exposed = selectExposedTools({
        tools: allTools,
        isInEnabledToolset: () => false,
        individuallyEnabledTools: new Set(["gitlab_api_request"]),
        featureFlagOverrides: new Set(),
        isAllowedByPermissionMode: () => true,
        deniedToolsRegex: undefined,
        hiddenToolNames: new Set(),
        applySlimProfile: false,
        isAdditiveEnablementAllowed: name => !isExplicitToolsetOnlyTool(name),
      });

      assert.equal(
        exposed.some(tool => tool.name === "gitlab_api_request"),
        false
      );
    });
  });
});

describe("When checking CLI exposure", () => {
  describe("with GITLAB_TOOLS and no api toolset", () => {
    it("should refuse gitlab_api_request", () => {
      const exposed = isToolExposed({
        toolName: "gitlab_api_request",
        enabledToolsets: parseEnabledToolsets("core"),
        individuallyEnabledTools: new Set(["gitlab_api_request"]),
        featureFlagOverrides: new Set(),
        deniedRegex: undefined,
        hiddenTools: new Set(),
      });

      assert.equal(exposed, false);
    });
  });
});

describe("When enforcing gitlab_api_request methods", () => {
  describe("with readonly mode", () => {
    it("should reject POST", () => {
      assert.throws(
        () => assertGitLabApiRequestMethodAllowed("POST", "readonly"),
        GitLabApiRequestInputError
      );
    });
  });

  describe("with modify mode", () => {
    it("should reject DELETE", () => {
      assert.throws(() => assertGitLabApiRequestMethodAllowed("DELETE", "modify"), /DELETE/);
    });
  });
});

describe("When executing gitlab_api_request", () => {
  describe("with query parameters", () => {
    it("should encode them on the request URL", async () => {
      let requested = "";
      const result = await executeGitLabApiRequestAsync({
        args: {
          path: "projects/5",
          query: { search: "a b", page: 2, state: true, labels: ["x", "y"] },
        },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl: async url => {
          requested = url;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      });

      const parsed = new URL(requested);
      assert.equal(parsed.searchParams.get("search"), "a b");
      assert.equal(parsed.searchParams.get("page"), "2");
      assert.equal(parsed.searchParams.get("state"), "true");
      assert.deepEqual(parsed.searchParams.getAll("labels"), ["x", "y"]);
      assert.match(result.content[0].text, /"ok": true/);
    });
  });

  describe("with a project outside the allowlist", () => {
    it("should reject before fetch", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/9" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: async () => {
              throw new Error("fetch should not run");
            },
          }),
        /not in the allowed project list/
      );
    });
  });

  describe("with a non-JSON success body", () => {
    it("should redact a plain-text token before returning it", async () => {
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5/repository/files/note/raw" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl: async () => new Response("token: plain-secret\nkeep", { status: 200 }),
      });

      assert.equal(result.content[0].text.includes("plain-secret"), false);
      assert.match(result.content[0].text, /keep/);
    });
  });

  describe("with a non-JSON error body", () => {
    it("should redact import_url text in the error", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: [],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: async () =>
              new Response("import_url=https://user:pass@example.com/repo.git", {
                status: 500,
                statusText: "Error",
              }),
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestHttpError);
          assert.equal(error.message.includes("user:pass"), false);
          assert.match(error.message, /500/);
          return true;
        }
      );
    });
  });

  describe("with a non-2xx JSON body", () => {
    it("should raise a status error without the token field", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: [],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: async () =>
              new Response(JSON.stringify({ message: "nope", token: "secret-token" }), {
                status: 403,
                statusText: "Forbidden",
              }),
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestHttpError);
          assert.match(error.message, /403/);
          assert.equal(error.message.includes("secret-token"), false);
          return true;
        }
      );
    });
  });
});
