import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getPositionalCliCommand } from "../cli-command.js";
import { gitlabOriginFromApiUrl, runAuthCommandAsync } from "../auth-cli.js";
import { runDeviceAuthorizationGrantAsync, type FetchImpl } from "../oauth-device-flow.js";
import { GitLabOAuth } from "../oauth.js";

const GITLAB_URL = "https://gitlab.example";
const CLIENT_ID = "test-client-id";
const DEVICE_CODE = "device-code-not-for-stdout";
const USER_CODE = "0A44L90H";
const ACCESS_TOKEN = "oauth-device-flow-access-token";
const REFRESH_TOKEN = "refresh-token-device-flow";

interface JsonResponse {
  status: number;
  body: unknown;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createFetchStub(
  plan: {
    authorize: JsonResponse;
    tokens: JsonResponse[];
  },
  capture?: { authorizeBodies: string[] }
): FetchImpl {
  const remainingTokens = [...plan.tokens];
  return async (input, init) => {
    const url = requestUrl(input);
    if (url.includes("/oauth/authorize_device")) {
      if (typeof init?.body === "string") {
        capture?.authorizeBodies.push(init.body);
      }
      return jsonResponse(plan.authorize.status, plan.authorize.body);
    }
    if (url.includes("/oauth/token")) {
      const next = remainingTokens.shift();
      if (!next) {
        throw new Error(`Unexpected token poll: ${url}`);
      }
      return jsonResponse(next.status, next.body);
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
}

function deviceAuthorizationBody(interval = 5): unknown {
  return {
    device_code: DEVICE_CODE,
    user_code: USER_CODE,
    verification_uri: `${GITLAB_URL}/oauth/device`,
    verification_uri_complete: `${GITLAB_URL}/oauth/device?user_code=${USER_CODE}`,
    expires_in: 300,
    interval,
  };
}

function successTokenBody(): unknown {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_in: 7200,
    token_type: "Bearer",
  };
}

function pendingBody(): unknown {
  return { error: "authorization_pending" };
}

function createTempTokenPath(): string {
  return path.join(
    os.tmpdir(),
    `gitlab-mcp-device-flow-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );
}

function createOauthClient(tokenStoragePath: string): GitLabOAuth {
  return new GitLabOAuth({
    clientId: CLIENT_ID,
    redirectUri: "http://127.0.0.1:8888/callback",
    gitlabUrl: GITLAB_URL,
    scopes: ["api"],
    tokenStoragePath,
  });
}

function createAuthorizeCapture(): { authorizeBodies: string[] } {
  return { authorizeBodies: [] };
}

function capturedAuthorizeScope(bodies: string[]): string | null {
  if (bodies.length !== 1) {
    return null;
  }
  const [body] = bodies;
  if (body === undefined) {
    return null;
  }
  return new URLSearchParams(body).get("scope");
}

async function runAuthCapturingScopeAsync(input: {
  extraArgv?: string[];
  env?: NodeJS.ProcessEnv;
}): Promise<string | null> {
  const tokenPath = createTempTokenPath();
  const capture = createAuthorizeCapture();
  const fetchImpl = createFetchStub(
    {
      authorize: { status: 200, body: deviceAuthorizationBody() },
      tokens: [{ status: 200, body: successTokenBody() }],
    },
    capture
  );

  try {
    await runAuthCommandAsync({
      argv: [
        "node",
        "index.js",
        "auth",
        `--client-id=${CLIENT_ID}`,
        `--api-url=${GITLAB_URL}`,
        `--token-path=${tokenPath}`,
        ...(input.extraArgv ?? []),
      ],
      env: input.env ?? {},
      stdout: createStdoutBuffer().stdout,
      fetchImpl,
      sleepAsync: async () => {},
    });
    return capturedAuthorizeScope(capture.authorizeBodies);
  } finally {
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  }
}

function createStdoutBuffer(): { stdout: { write(chunk: string): boolean }; text: () => string } {
  const chunks: string[] = [];
  return {
    stdout: {
      write(chunk: string) {
        chunks.push(chunk);
        return true;
      },
    },
    text: () => chunks.join(""),
  };
}

function createSleepRecorder(): {
  sleepAsync: (ms: number) => Promise<void>;
  delays: number[];
} {
  const delays: number[] = [];
  return {
    delays,
    async sleepAsync(ms: number) {
      delays.push(ms);
    },
  };
}

function readStoredToken(value: unknown): {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  created_at: number;
  token_type: string;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error("token file is not an object");
  }
  const accessToken = Reflect.get(value, "access_token");
  const refreshToken = Reflect.get(value, "refresh_token");
  const expiresIn = Reflect.get(value, "expires_in");
  const createdAt = Reflect.get(value, "created_at");
  const tokenType = Reflect.get(value, "token_type");
  if (typeof accessToken !== "string") {
    throw new Error("access_token missing");
  }
  if (typeof createdAt !== "number") {
    throw new Error("created_at missing");
  }
  if (typeof tokenType !== "string") {
    throw new Error("token_type missing");
  }
  return {
    access_token: accessToken,
    refresh_token: typeof refreshToken === "string" ? refreshToken : undefined,
    expires_in: typeof expiresIn === "number" ? expiresIn : undefined,
    created_at: createdAt,
    token_type: tokenType,
  };
}

describe("When reading the CLI command", () => {
  describe("with auth as the first positional argument", () => {
    it("should return auth", () => {
      assert.equal(getPositionalCliCommand(["node", "index.js", "auth"]), "auth");
    });
  });

  describe("with only --token", () => {
    it("should return undefined so MCP startup stays unchanged", () => {
      assert.equal(
        getPositionalCliCommand(["node", "index.js", "--token=glpat-xxxxxxxx"]),
        undefined
      );
    });
  });

  describe("with flags before auth", () => {
    it("should still return auth", () => {
      assert.equal(
        getPositionalCliCommand(["node", "index.js", "--api-url=https://gitlab.com", "auth"]),
        "auth"
      );
    });
  });

  describe("with tsx index.ts auth", () => {
    it("should skip the script path and return auth", () => {
      assert.equal(
        getPositionalCliCommand(["node", "/usr/local/bin/tsx", "index.ts", "auth", "--help"]),
        "auth"
      );
    });
  });

  describe("with space-separated --api-url before auth", () => {
    it("should skip the URL value and return auth", () => {
      assert.equal(
        getPositionalCliCommand([
          "node",
          "index.js",
          "--api-url",
          "https://gitlab.example/api/v4",
          "auth",
        ]),
        "auth"
      );
    });
  });

  describe("with space-separated --client-id before auth", () => {
    it("should skip the client id value and return auth", () => {
      assert.equal(
        getPositionalCliCommand(["node", "index.js", "--client-id", "app-id", "auth"]),
        "auth"
      );
    });
  });

  describe("with -h before auth", () => {
    it("should not consume auth as a help value", () => {
      assert.equal(getPositionalCliCommand(["node", "index.js", "-h", "auth"]), "auth");
    });
  });
});

describe("When converting a GitLab API URL", () => {
  describe("with an /api/v4 suffix", () => {
    it("should strip it the same way initializeOAuthClient does", () => {
      assert.equal(gitlabOriginFromApiUrl("https://gitlab.com/api/v4"), "https://gitlab.com");
    });
  });

  describe("with a trailing slash after /api/v4", () => {
    it("should strip the suffix and trailing slash", () => {
      assert.equal(
        gitlabOriginFromApiUrl("https://gitlab.example/api/v4/"),
        "https://gitlab.example"
      );
    });
  });
});

describe("When running device authorization grant", () => {
  describe("with authorization_pending then a token", () => {
    it("should return TokenData compatible with the existing OAuth store", async () => {
      const fetchImpl = createFetchStub({
        authorize: { status: 200, body: deviceAuthorizationBody() },
        tokens: [
          { status: 400, body: pendingBody() },
          { status: 200, body: successTokenBody() },
        ],
      });
      const sleep = createSleepRecorder();

      const token = await runDeviceAuthorizationGrantAsync({
        gitlabUrl: GITLAB_URL,
        clientId: CLIENT_ID,
        scopes: ["api"],
        fetchImpl,
        sleepAsync: sleep.sleepAsync,
      });

      assert.equal(token.access_token, ACCESS_TOKEN);
      assert.equal(token.refresh_token, REFRESH_TOKEN);
      assert.equal(token.expires_in, 7200);
      assert.equal(token.token_type, "Bearer");
      assert.equal(typeof token.created_at, "number");
      assert.deepEqual(sleep.delays, [5000]);
    });
  });

  describe("with slow_down then a token", () => {
    it("should wait the increased interval before the next poll", async () => {
      const fetchImpl = createFetchStub({
        authorize: { status: 200, body: deviceAuthorizationBody(5) },
        tokens: [
          { status: 400, body: { error: "slow_down" } },
          { status: 200, body: successTokenBody() },
        ],
      });
      const sleep = createSleepRecorder();

      await runDeviceAuthorizationGrantAsync({
        gitlabUrl: GITLAB_URL,
        clientId: CLIENT_ID,
        scopes: ["api"],
        fetchImpl,
        sleepAsync: sleep.sleepAsync,
      });

      assert.deepEqual(sleep.delays, [10000]);
    });
  });
});

describe("When the token endpoint returns expired_token", () => {
  describe("with no token file yet", () => {
    it("should throw and not write a token file", async () => {
      const tokenPath = createTempTokenPath();
      const fetchImpl = createFetchStub({
        authorize: { status: 200, body: deviceAuthorizationBody() },
        tokens: [{ status: 400, body: { error: "expired_token" } }],
      });

      const oauth = createOauthClient(tokenPath);
      await assert.rejects(
        () => oauth.runDeviceFlowAsync({ fetchImpl, sleepAsync: async () => {} }),
        /Device code expired/
      );
      assert.equal(fs.existsSync(tokenPath), false);
    });
  });
});

describe("When the token endpoint returns access_denied", () => {
  describe("with no token file yet", () => {
    it("should throw and not write a token file", async () => {
      const tokenPath = createTempTokenPath();
      const fetchImpl = createFetchStub({
        authorize: { status: 200, body: deviceAuthorizationBody() },
        tokens: [{ status: 400, body: { error: "access_denied" } }],
      });

      const oauth = createOauthClient(tokenPath);
      await assert.rejects(
        () => oauth.runDeviceFlowAsync({ fetchImpl, sleepAsync: async () => {} }),
        /Authorization was denied/
      );
      assert.equal(fs.existsSync(tokenPath), false);
    });
  });
});

describe("When GitLab returns 404 for authorize_device", () => {
  describe("with a self-managed instance", () => {
    it("should tell the user to use a PAT", async () => {
      const fetchImpl = createFetchStub({
        authorize: { status: 404, body: { error: "not_found" } },
        tokens: [],
      });

      await assert.rejects(
        () =>
          runDeviceAuthorizationGrantAsync({
            gitlabUrl: GITLAB_URL,
            clientId: CLIENT_ID,
            scopes: ["api"],
            fetchImpl,
            sleepAsync: async () => {},
          }),
        /GITLAB_PERSONAL_ACCESS_TOKEN/
      );
    });
  });
});

describe("When device flow succeeds", () => {
  describe("with GitLabOAuth.saveToken", () => {
    it("should persist the existing token file shape", async () => {
      const tokenPath = createTempTokenPath();
      const fetchImpl = createFetchStub({
        authorize: { status: 200, body: deviceAuthorizationBody() },
        tokens: [{ status: 200, body: successTokenBody() }],
      });

      try {
        await createOauthClient(tokenPath).runDeviceFlowAsync({
          fetchImpl,
          sleepAsync: async () => {},
        });

        const raw: unknown = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        const stored = readStoredToken(raw);
        assert.equal(stored.access_token, ACCESS_TOKEN);
        assert.equal(stored.refresh_token, REFRESH_TOKEN);
        assert.equal(stored.expires_in, 7200);
        assert.equal(stored.token_type, "Bearer");
        assert.equal(typeof stored.created_at, "number");
        assert.equal(fs.statSync(tokenPath).mode & 0o777, 0o600);
      } finally {
        if (fs.existsSync(tokenPath)) {
          fs.unlinkSync(tokenPath);
        }
      }
    });
  });
});

describe("When running the auth command", () => {
  describe("with --help", () => {
    it("should print usage and not fetch", async () => {
      const out = createStdoutBuffer();
      const fetchImpl: FetchImpl = async () => {
        throw new Error("fetch should not run for --help");
      };

      await runAuthCommandAsync({
        argv: ["node", "index.js", "auth", "--help"],
        env: {},
        stdout: out.stdout,
        fetchImpl,
      });

      assert.match(out.text(), /zereight-mcp-gitlab auth/);
      assert.equal(out.text().includes(DEVICE_CODE), false);
    });
  });

  describe("without a client id", () => {
    it("should fail before calling GitLab", async () => {
      await assert.rejects(
        () =>
          runAuthCommandAsync({
            argv: ["node", "index.js", "auth"],
            env: {},
            stdout: createStdoutBuffer().stdout,
            fetchImpl: async () => {
              throw new Error("fetch should not run without client id");
            },
          }),
        /GITLAB_OAUTH_CLIENT_ID/
      );
    });
  });

  describe("with a successful device flow", () => {
    it("should print the user code and not the device code or access token", async () => {
      const tokenPath = createTempTokenPath();
      const out = createStdoutBuffer();
      const fetchImpl = createFetchStub({
        authorize: { status: 200, body: deviceAuthorizationBody() },
        tokens: [{ status: 200, body: successTokenBody() }],
      });

      try {
        await runAuthCommandAsync({
          argv: [
            "node",
            "index.js",
            "auth",
            `--client-id=${CLIENT_ID}`,
            `--api-url=${GITLAB_URL}`,
            `--token-path=${tokenPath}`,
          ],
          env: {},
          stdout: out.stdout,
          fetchImpl,
          sleepAsync: async () => {},
        });

        const printed = out.text();
        assert.equal(printed.includes(USER_CODE), true);
        assert.match(printed, /Token saved to/);
        assert.match(printed, /GITLAB_USE_OAUTH=true/);
        assert.match(printed, /GITLAB_OAUTH_TOKEN_PATH/);
        assert.equal(printed.includes(DEVICE_CODE), false);
        assert.equal(printed.includes(ACCESS_TOKEN), false);
        assert.equal(fs.existsSync(tokenPath), true);
      } finally {
        if (fs.existsSync(tokenPath)) {
          fs.unlinkSync(tokenPath);
        }
      }
    });
  });

  describe("without a read-only flag", () => {
    it("should request the api scope", async () => {
      assert.equal(await runAuthCapturingScopeAsync({}), "api");
    });
  });

  describe("with --permission-mode=readonly", () => {
    it("should request the read_api scope", async () => {
      assert.equal(
        await runAuthCapturingScopeAsync({ extraArgv: ["--permission-mode=readonly"] }),
        "read_api"
      );
    });
  });

  describe("with GITLAB_PERMISSION_MODE=readonly", () => {
    it("should request the read_api scope", async () => {
      assert.equal(
        await runAuthCapturingScopeAsync({ env: { GITLAB_PERMISSION_MODE: "readonly" } }),
        "read_api"
      );
    });
  });

  describe("with --read-only=true", () => {
    it("should request the read_api scope", async () => {
      assert.equal(
        await runAuthCapturingScopeAsync({ extraArgv: ["--read-only=true"] }),
        "read_api"
      );
    });
  });
});

