import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Logger } from "pino";
import type { Dispatcher } from "undici";

// config.js reads the environment once at import, so pin standard PAT mode first.
for (const key of [
  "REMOTE_AUTHORIZATION",
  "GITLAB_MCP_OAUTH",
  "ENABLE_DYNAMIC_API_URL",
  "ENABLE_DYNAMIC_PROJECT_SCOPE",
  "GITLAB_JOB_TOKEN",
  "GITLAB_IS_OLD",
  "GITLAB_PERSONAL_ACCESS_TOKEN_FILE",
  "GITLAB_PERMISSION_MODE",
]) {
  delete process.env[key];
}
process.env.GITLAB_PERSONAL_ACCESS_TOKEN = "test-token-request-context-0000";

const context = await import("../../server/gitlab-request-context.js");

const DEFAULT_API_URL = "https://gitlab.example.com/api/v4";
const fakeDispatcher = {} as Dispatcher;
const dispatcherUrls: string[] = [];
let oauthAccessToken: string | null = null;

function configure(): void {
  context.configureGitLabRequestContext({
    logger: { debug() {}, warn() {} } as unknown as Logger,
    getDefaultApiUrl: () => DEFAULT_API_URL,
    getDefaultAllowedProjectIds: () => ["1", "group/project"],
    getDispatcherForUrl: apiUrl => {
      dispatcherUrls.push(apiUrl);
      return fakeDispatcher;
    },
    getOAuthAccessToken: () => oauthAccessToken,
  });
}

describe("When the request context is used before it is configured", () => {
  it("should throw instead of falling back to a value", () => {
    assert.throws(() => context.getEffectiveApiUrl(), /before configureGitLabRequestContext/);
    assert.throws(() => context.buildAuthHeaders(), /before configureGitLabRequestContext/);
  });
});

describe("When the request context is configured in standard PAT mode", () => {
  it("should send the PAT as a Bearer token with the base headers", () => {
    configure();
    oauthAccessToken = null;
    const { headers, dispatcher } = context.getFetchConfig();

    assert.deepEqual(headers, {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer test-token-request-context-0000",
    });
    assert.equal(dispatcher, fakeDispatcher);
    assert.deepEqual(dispatcherUrls.at(-1), DEFAULT_API_URL);
    assert.equal(context.usesJobTokenHeader(), false);
  });

  it("should prefer the OAuth token read at call time over the PAT", () => {
    configure();
    oauthAccessToken = "oauth-token-0000";
    try {
      assert.deepEqual(context.buildAuthHeaders(), { Authorization: "Bearer oauth-token-0000" });
    } finally {
      oauthAccessToken = null;
    }
  });

  it("should use the default API URL and allowlist", () => {
    configure();
    assert.equal(context.getEffectiveApiUrl(), DEFAULT_API_URL);
    assert.deepEqual(context.getEffectiveAllowedProjectIds(), ["1", "group/project"]);
  });
});

describe("When a session project scope is bound", () => {
  it("should let an unscoped session take the requested scope", () => {
    assert.deepEqual(context.bindSessionProjectScope(["1"], undefined), ["1"]);
    assert.equal(context.bindSessionProjectScope(undefined, []), undefined);
  });

  it("should keep the session scope when the request omits it", () => {
    assert.deepEqual(context.bindSessionProjectScope(undefined, ["1", "2"]), ["1", "2"]);
  });

  it("should accept the same scope in another order", () => {
    assert.deepEqual(context.bindSessionProjectScope(["2", "1"], ["1", "2"]), ["1", "2"]);
  });

  it("should refuse a different scope", () => {
    assert.equal(context.bindSessionProjectScope(["1", "3"], ["1", "2"]), null);
    assert.equal(context.bindSessionProjectScope(["1"], ["1", "2"]), null);
  });
});

describe("When the public base URL of a session is updated", () => {
  const authData = {
    header: "Authorization" as const,
    token: "session-token",
    lastUsed: 0,
    apiUrl: DEFAULT_API_URL,
  };

  it("should keep the previous public base URL when none is given", () => {
    const previous = { ...authData, publicBaseUrl: "https://mcp.example.com" };
    assert.equal(
      context.withPublicBaseUrl(authData, undefined, previous).publicBaseUrl,
      "https://mcp.example.com"
    );
    assert.equal(context.withPublicBaseUrl(authData), authData);
  });

  it("should update only a known session", () => {
    context.authBySession["session-a"] = { ...authData };
    try {
      context.updateSessionPublicBaseUrl("session-a", "https://proxy.example.com");
      context.updateSessionPublicBaseUrl("session-b", "https://proxy.example.com");
      assert.equal(context.authBySession["session-a"].publicBaseUrl, "https://proxy.example.com");
      assert.equal(context.authBySession["session-b"], undefined);
    } finally {
      delete context.authBySession["session-a"];
    }
  });
});
