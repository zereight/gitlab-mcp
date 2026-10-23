import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Response as UndiciResponse } from "undici";

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
import type { ValidatedRedirectFetch } from "../../utils/safe-redirect-fetch.js";
import { resolveGitLabApiRequestUrl } from "../../utils/url.js";

const API_BASE = "http://127.0.0.1:9/api/v4";

const PUBLIC_REDIRECT_HOST = "93.184.216.34";

interface RecordedHop {
  readonly url: string;
  readonly headers: Record<string, string>;
}

function redirectFetch(location: string, calls: RecordedHop[]): ValidatedRedirectFetch {
  return async (input, init) => {
    calls.push({ url: String(input), headers: { ...(init?.headers ?? {}) } });
    if (calls.length === 1) {
      return new UndiciResponse(null, { status: 302, headers: { location } });
    }
    return new UndiciResponse(JSON.stringify({ followed: true }), { status: 200 });
  };
}

const CREDENTIAL_HEADERS = {
  Accept: "application/json",
  Authorization: "Bearer secret",
  "Private-Token": "pat-secret",
  "JOB-TOKEN": "job-secret",
};

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
          return new UndiciResponse(JSON.stringify({ ok: true }), { status: 200 });
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

  describe("with a single-encoded projects prefix outside the allowlist", () => {
    it("should reject before fetch", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "%70rojects/9" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: async () => {
              throw new Error("fetch should not run");
            },
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Project 9 is not in the allowed project list/);
          return true;
        }
      );
    });
  });

  describe("with a double-encoded projects prefix outside the allowlist", () => {
    it("should reject before fetch", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "%2570rojects/9" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: async () => {
              throw new Error("fetch should not run");
            },
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Project 9 is not in the allowed project list/);
          return true;
        }
      );
    });
  });

  describe("with an allowlist and a redirect to a single-encoded projects prefix", () => {
    it("should refuse the hop before requesting it", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/%70rojects/9", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Project 9 is not in the allowed project list/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
    });
  });

  describe("with an allowlist and a redirect to a double-encoded projects prefix", () => {
    it("should refuse the hop before requesting it", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/%2570rojects/9", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Project 9 is not in the allowed project list/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
    });
  });

  describe("with an encoded project path inside the allowlist", () => {
    it("should request that project", async () => {
      let requested = "";
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/group%2Fproj" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["group/proj"],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl: async url => {
          requested = url;
          return new UndiciResponse(JSON.stringify({ ok: true }), { status: 200 });
        },
      });

      assert.equal(requested, `${API_BASE}/projects/group%2Fproj`);
      assert.match(result.content[0].text, /"ok": true/);
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
        fetchImpl: async () => new UndiciResponse("token: plain-secret\nkeep", { status: 200 }),
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
              new UndiciResponse("import_url=https://user:pass@example.com/repo.git", {
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

  describe("with a JSON body", () => {
    it("should send POST and the serialized body", async () => {
      const seen = { method: "", body: "" };
      const fetchImpl: ValidatedRedirectFetch = async (_input, init) => {
        seen.method = init?.method ?? "";
        seen.body = init?.body ?? "";
        return new UndiciResponse(JSON.stringify({ id: 1 }), {
          status: 201,
          statusText: "Created",
        });
      };

      await executeGitLabApiRequestAsync({
        args: { method: "POST", path: "projects/5/issues", body: { title: "t" } },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl,
      });

      assert.deepEqual([seen.method, seen.body], ["POST", JSON.stringify({ title: "t" })]);
    });
  });

  describe("with a cross-origin redirect", () => {
    it("should withhold credential headers from the next hop", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch(`http://${PUBLIC_REDIRECT_HOST}/object`, calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5/jobs/7/artifacts" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, `http://${PUBLIC_REDIRECT_HOST}/object`);
      assert.equal(calls[1]?.headers.Authorization, undefined);
      assert.equal(calls[1]?.headers["Private-Token"], undefined);
      assert.equal(calls[1]?.headers["JOB-TOKEN"], undefined);
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with a POST redirected to another origin", () => {
    it("should follow as GET without the body or credential headers", async () => {
      const calls: Array<RecordedHop & { readonly method: string; readonly body?: string }> = [];
      const fetchImpl: ValidatedRedirectFetch = async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? "",
          body: init?.body,
          headers: { ...(init?.headers ?? {}) },
        });
        if (calls.length === 1) {
          return new UndiciResponse(null, {
            status: 302,
            headers: { location: `http://${PUBLIC_REDIRECT_HOST}/object` },
          });
        }
        return new UndiciResponse(JSON.stringify({ followed: true }), { status: 200 });
      };

      await executeGitLabApiRequestAsync({
        args: { method: "POST", path: "projects/5/issues", body: { title: "t" } },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[0]?.method, "POST");
      assert.equal(calls[1]?.method, "GET");
      assert.equal(calls[1]?.body, undefined);
      assert.equal(calls[1]?.headers["Private-Token"], undefined);
      assert.equal(calls[1]?.headers["JOB-TOKEN"], undefined);
    });
  });

  describe("with a same-origin redirect", () => {
    it("should keep credential headers on the next hop", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/projects/5", calls);
      await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.headers["Private-Token"], "pat-secret");
      assert.equal(calls[1]?.headers["JOB-TOKEN"], "job-secret");
    });
  });

  describe("with a same-origin redirect outside the API base path", () => {
    it("should reject the hop before sending credentials", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/users/sign_in", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: [],
            fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Redirect target must remain under the GitLab API base path/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, `${API_BASE}/projects/5`);
      assert.equal(
        calls.some(call => call.url.includes("/users/sign_in")),
        false
      );
    });
  });

  describe("with an allowlist and a same-origin redirect outside the API base path", () => {
    it("should reject the hop before sending credentials", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/users/sign_in", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Redirect target must remain under the GitLab API base path/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, `${API_BASE}/projects/5`);
      assert.equal(
        calls.some(call => call.url.includes("/users/sign_in")),
        false
      );
    });
  });

  describe("with an allowlist and a cross-origin redirect outside the API base path", () => {
    it("should follow the hop without credential headers", async () => {
      const calls: RecordedHop[] = [];
      const location = `http://${PUBLIC_REDIRECT_HOST}/users/sign_in`;
      const fetchImpl = redirectFetch(location, calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5"],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, location);
      assert.equal(calls[1]?.headers.Authorization, undefined);
      assert.equal(calls[1]?.headers["Private-Token"], undefined);
      assert.equal(calls[1]?.headers["JOB-TOKEN"], undefined);
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with a redirect to the API base path itself", () => {
    it("should follow the empty relative path", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/", calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, `${API_BASE}/`);
      assert.equal(calls[1]?.headers["Private-Token"], "pat-secret");
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with an allowlist and a redirect to another project", () => {
    it("should refuse the hop before requesting it", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/projects/9/issues", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Project 9 is not in the allowed project list/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
    });
  });

  describe("with an allowlist and a redirect to the same project", () => {
    it("should follow the hop", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/projects/5/issues", calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5"],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, `${API_BASE}/projects/5/issues`);
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with an allowlist and a redirect to another project on a trusted host", () => {
    it("should refuse the hop before requesting it", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch(
        "https://gitlab-alias.example/api/v4/projects/9/issues",
        calls
      );

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
            isTrustedRedirectHost: host => host === "gitlab-alias.example",
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Project 9 is not in the allowed project list/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
    });
  });

  describe("with an allowlist and a redirect to the same project on a trusted host", () => {
    it("should follow the hop and keep the credential headers", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch(
        "https://gitlab-alias.example/api/v4/projects/5/issues",
        calls
      );
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5"],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
        isTrustedRedirectHost: host => host === "gitlab-alias.example",
      });

      assert.equal(calls[1]?.url, "https://gitlab-alias.example/api/v4/projects/5/issues");
      assert.equal(calls[1]?.headers["Private-Token"], "pat-secret");
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with a redirect to a sign-in path on a trusted host", () => {
    it("should reject the hop before sending credentials", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("https://gitlab-alias.example/users/sign_in", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: [],
            fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
            isTrustedRedirectHost: host => host === "gitlab-alias.example",
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, /Redirect target must remain under the GitLab API base path/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, `${API_BASE}/projects/5`);
      assert.equal(
        calls.some(call => call.url.includes("/users/sign_in")),
        false
      );
    });
  });

  describe("with an allowlist and a redirect to a project path on a trusted host", () => {
    it("should follow the hop and keep the credential headers", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("https://gitlab-alias.example/api/v4/projects/5", calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5"],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
        isTrustedRedirectHost: host => host === "gitlab-alias.example",
      });

      assert.equal(calls[1]?.url, "https://gitlab-alias.example/api/v4/projects/5");
      assert.equal(calls[1]?.headers["Private-Token"], "pat-secret");
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with an allowlist and an untrusted redirect to another project API path", () => {
    it("should follow the hop without credential headers", async () => {
      const calls: RecordedHop[] = [];
      const location = `http://${PUBLIC_REDIRECT_HOST}/api/v4/projects/9/issues`;
      const fetchImpl = redirectFetch(location, calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5"],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, location);
      assert.equal(calls[1]?.headers["Private-Token"], undefined);
      assert.match(result.content[0].text, /followed/);
    });
  });

  describe("with a redirect to a private address", () => {
    it("should refuse the hop before reading a body", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("http://169.254.169.254/latest/meta-data/", calls);

      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "projects/5/jobs/7/artifacts" },
            apiBaseUrl: API_BASE,
            permissionMode: "full",
            allowedProjectIds: [],
            fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
            fetchImpl,
            unauthenticatedFetchImpl: fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestHttpError);
          assert.match(error.message, /non-public address/);
          return true;
        }
      );
      assert.equal(calls.length, 1);
    });
  });

  describe("with a 303 redirect", () => {
    it("should follow PUT as GET and drop the body", async () => {
      const calls: Array<{ readonly method: string; readonly body?: string }> = [];
      const fetchImpl: ValidatedRedirectFetch = async (_input, init) => {
        calls.push({ method: init?.method ?? "", body: init?.body });
        if (calls.length === 1) {
          return new UndiciResponse(null, {
            status: 303,
            headers: { location: `http://${PUBLIC_REDIRECT_HOST}/object` },
          });
        }
        return new UndiciResponse(JSON.stringify({ followed: true }), { status: 200 });
      };

      await executeGitLabApiRequestAsync({
        args: { method: "PUT", path: "projects/5/issues/1", body: { title: "t" } },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.method, "GET");
      assert.equal(calls[1]?.body, undefined);
    });
  });

  describe("with a 307 redirect", () => {
    it("should keep the POST method and body", async () => {
      const calls: Array<{ readonly method: string; readonly body?: string }> = [];
      const fetchImpl: ValidatedRedirectFetch = async (_input, init) => {
        calls.push({ method: init?.method ?? "", body: init?.body });
        if (calls.length === 1) {
          return new UndiciResponse(null, {
            status: 307,
            headers: { location: "/api/v4/projects/5/issues" },
          });
        }
        return new UndiciResponse(JSON.stringify({ kept: true }), { status: 200 });
      };

      await executeGitLabApiRequestAsync({
        args: { method: "POST", path: "projects/5/issues", body: { title: "t" } },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.method, "POST");
      assert.equal(calls[1]?.body, JSON.stringify({ title: "t" }));
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
              new UndiciResponse(JSON.stringify({ message: "nope", token: "secret-token" }), {
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

const NOT_PROJECT_SCOPED =
  /^Access denied: .*not scoped to a project in the allowed project list: 5\b/;

function fetchMustNotRun(): ValidatedRedirectFetch {
  return async () => {
    throw new Error("fetch should not run");
  };
}

function okFetch(requested: string[]): ValidatedRedirectFetch {
  return async url => {
    requested.push(String(url));
    return new UndiciResponse(JSON.stringify({ ok: true }), { status: 200 });
  };
}

describe("When a project allowlist is in effect for gitlab_api_request", () => {
  describe("with a path that names no project", () => {
    const cases: ReadonlyArray<{
      readonly path: string;
      readonly method?: "GET" | "POST";
      readonly query?: Record<string, string>;
      readonly body?: unknown;
    }> = [
      { path: "groups/1/projects" },
      { path: "groups/group%2Fsub/variables" },
      { path: "users" },
      { path: "user" },
      { path: "search", query: { scope: "blobs", search: "password" } },
      { path: "projects" },
      { path: "/projects/" },
      { path: "projects", method: "POST", body: { name: "outside" } },
      { path: "runners/all" },
      { path: "admin/ci/variables" },
      { path: "application/settings" },
      { path: "namespaces" },
      { path: "snippets/1" },
      { path: "version" },
      { path: "%67roups/1" },
      { path: "%2567roups/1" },
      { path: "projects%2F9" },
      { path: "projects%252F9" },
      { path: "Projects/9" },
      { path: "PROJECTS/5" },
    ];
    for (const { path, method, query, body } of cases) {
      it(`should reject ${method ?? "GET"} ${path} before fetch`, async () => {
        await assert.rejects(
          () =>
            executeGitLabApiRequestAsync({
              args: { path, method, query, body },
              apiBaseUrl: API_BASE,
              permissionMode: "full",
              allowedProjectIds: ["5"],
              fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
              fetchImpl: fetchMustNotRun(),
            }),
          (error: unknown) => {
            assert.ok(error instanceof GitLabApiRequestInputError);
            assert.match(error.message, NOT_PROJECT_SCOPED);
            return true;
          }
        );
      });
    }
  });

  describe("with a malformed path that could hide another route", () => {
    const paths = [
      "projects//9",
      "projects/5//issues",
      "//groups/1",
      "projects/%2F9",
      "projects/5/../../groups/1",
      "projects/5/%2e%2e/%2e%2e/groups/1",
      "projects/5%2F..%2F..%2Fgroups%2F1",
      "projects/5/%252e%252e/%252e%252e/users",
    ];
    for (const path of paths) {
      it(`should reject ${path} before fetch`, async () => {
        await assert.rejects(
          () =>
            executeGitLabApiRequestAsync({
              args: { path },
              apiBaseUrl: API_BASE,
              permissionMode: "full",
              allowedProjectIds: ["5"],
              fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
              fetchImpl: fetchMustNotRun(),
            }),
          GitLabApiRequestInputError
        );
      });
    }
  });

  describe("with a project id that only resembles an allowed one", () => {
    const cases: ReadonlyArray<{ readonly path: string; readonly projectId: string }> = [
      { path: "projects/5?private=1", projectId: "5?private=1" },
      { path: "projects/9%2Fissues", projectId: "9/issues" },
      { path: "projects/05", projectId: "05" },
    ];
    for (const { path, projectId } of cases) {
      it(`should reject ${path} before fetch`, async () => {
        await assert.rejects(
          () =>
            executeGitLabApiRequestAsync({
              args: { path },
              apiBaseUrl: API_BASE,
              permissionMode: "full",
              allowedProjectIds: ["5"],
              fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
              fetchImpl: fetchMustNotRun(),
            }),
          (error: unknown) => {
            assert.ok(error instanceof GitLabApiRequestInputError);
            assert.equal(
              error.message,
              `Access denied: Project ${projectId} is not in the allowed project list: 5`
            );
            return true;
          }
        );
      });
    }
  });

  describe("with a path under an allowed project", () => {
    const cases: ReadonlyArray<{ readonly path: string; readonly expected: string }> = [
      { path: "projects/5", expected: `${API_BASE}/projects/5` },
      { path: "/projects/5/", expected: `${API_BASE}/projects/5` },
      { path: "projects/5/issues", expected: `${API_BASE}/projects/5/issues?state=opened` },
      { path: "%70rojects/5/merge_requests", expected: `${API_BASE}/projects/5/merge_requests` },
    ];
    for (const { path, expected } of cases) {
      it(`should request ${path}`, async () => {
        const requested: string[] = [];
        await executeGitLabApiRequestAsync({
          args: { path, query: path.endsWith("issues") ? { state: "opened" } : undefined },
          apiBaseUrl: API_BASE,
          permissionMode: "full",
          allowedProjectIds: ["5"],
          fetchConfig: () => ({ headers: {} }),
          fetchImpl: okFetch(requested),
        });
        assert.deepEqual(requested, [expected]);
      });
    }

    it("should request a namespace path listed in the allowlist", async () => {
      const requested: string[] = [];
      await executeGitLabApiRequestAsync({
        args: { path: "projects/group%2Fproj/issues" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5", "group/proj"],
        fetchConfig: () => ({ headers: {} }),
        fetchImpl: okFetch(requested),
      });
      assert.deepEqual(requested, [`${API_BASE}/projects/group%2Fproj/issues`]);
    });
  });

  describe("with readonly mode", () => {
    it("should still reject POST to an allowed project", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { method: "POST", path: "projects/5/issues", body: { title: "x" } },
            apiBaseUrl: API_BASE,
            permissionMode: "readonly",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: fetchMustNotRun(),
          }),
        /allows only GET/
      );
    });

    it("should reject GET to a path that names no project", async () => {
      await assert.rejects(
        () =>
          executeGitLabApiRequestAsync({
            args: { path: "groups/1" },
            apiBaseUrl: API_BASE,
            permissionMode: "readonly",
            allowedProjectIds: ["5"],
            fetchConfig: () => ({ headers: {} }),
            fetchImpl: fetchMustNotRun(),
          }),
        (error: unknown) => {
          assert.ok(error instanceof GitLabApiRequestInputError);
          assert.match(error.message, NOT_PROJECT_SCOPED);
          return true;
        }
      );
    });
  });

  describe("with a credentialed redirect to a path that names no project", () => {
    const locations = [
      "/api/v4/groups/1",
      "/api/v4/users",
      "/api/v4/search?scope=blobs&search=password",
      "/api/v4/projects",
      "/api/v4/",
      "/api/v4//groups/1",
      "/api/v4/%67roups/1",
      "/api/v4/projects%2F9",
      "https://gitlab-alias.example/api/v4/groups/1",
      "https://gitlab-alias.example/api/v4/",
    ];
    for (const location of locations) {
      it(`should refuse ${location} before requesting it`, async () => {
        const calls: RecordedHop[] = [];
        const fetchImpl = redirectFetch(location, calls);
        await assert.rejects(
          () =>
            executeGitLabApiRequestAsync({
              args: { path: "projects/5" },
              apiBaseUrl: API_BASE,
              permissionMode: "full",
              allowedProjectIds: ["5"],
              fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
              fetchImpl,
              unauthenticatedFetchImpl: fetchImpl,
              isTrustedRedirectHost: host => host === "gitlab-alias.example",
            }),
          (error: unknown) => {
            assert.ok(error instanceof GitLabApiRequestInputError);
            assert.match(error.message, NOT_PROJECT_SCOPED);
            return true;
          }
        );
        assert.equal(calls.length, 1);
      });
    }
  });

  describe("with an untrusted cross-origin redirect to a path that names no project", () => {
    it("should follow the hop without credential headers", async () => {
      const calls: RecordedHop[] = [];
      const location = `http://${PUBLIC_REDIRECT_HOST}/api/v4/groups/1`;
      const fetchImpl = redirectFetch(location, calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5/jobs/7/artifacts" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: ["5"],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, location);
      assert.equal(calls[1]?.headers["Private-Token"], undefined);
      assert.match(result.content[0].text, /followed/);
    });
  });
});

describe("When no project allowlist is in effect for gitlab_api_request", () => {
  describe("with a path that names no project", () => {
    for (const path of ["groups/1/projects", "users", "search", "projects", "version"]) {
      it(`should request ${path}`, async () => {
        const requested: string[] = [];
        await executeGitLabApiRequestAsync({
          args: { path },
          apiBaseUrl: API_BASE,
          permissionMode: "full",
          allowedProjectIds: [],
          fetchConfig: () => ({ headers: {} }),
          fetchImpl: okFetch(requested),
        });
        assert.deepEqual(requested, [`${API_BASE}/${path}`]);
      });
    }
  });

  describe("with a same-origin redirect to a path that names no project", () => {
    it("should follow the hop and keep the credential headers", async () => {
      const calls: RecordedHop[] = [];
      const fetchImpl = redirectFetch("/api/v4/groups/1", calls);
      const result = await executeGitLabApiRequestAsync({
        args: { path: "projects/5" },
        apiBaseUrl: API_BASE,
        permissionMode: "full",
        allowedProjectIds: [],
        fetchConfig: () => ({ headers: CREDENTIAL_HEADERS }),
        fetchImpl,
        unauthenticatedFetchImpl: fetchImpl,
      });

      assert.equal(calls[1]?.url, `${API_BASE}/groups/1`);
      assert.equal(calls[1]?.headers["Private-Token"], "pat-secret");
      assert.match(result.content[0].text, /followed/);
    });
  });
});
