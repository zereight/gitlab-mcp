import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, test } from "node:test";
import { checkForNewVersion, fetchLatestVersion, isNewerVersion } from "../../utils/version-check.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type CapturedFetch = {
  url: string;
  authorization: string | null;
  redirect: RequestRedirect | undefined;
};

function fetchReturning(status: number, body: unknown): FetchLike {
  return async () => new Response(JSON.stringify(body), { status });
}

function fetchCapturing(calls: CapturedFetch[], status: number, body: unknown): FetchLike {
  return async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: url.toString(),
      authorization: headers.get("authorization"),
      redirect: init?.redirect,
    });
    return new Response(JSON.stringify(body), { status });
  };
}

describe("When isNewerVersion compares versions", () => {
  test("should detect newer patch, minor, and major versions", () => {
    assert.equal(isNewerVersion("2.1.30", "2.1.29"), true);
    assert.equal(isNewerVersion("2.2.0", "2.1.29"), true);
    assert.equal(isNewerVersion("3.0.0", "2.1.29"), true);
  });

  test("should return false for equal or older versions", () => {
    assert.equal(isNewerVersion("2.1.29", "2.1.29"), false);
    assert.equal(isNewerVersion("2.1.28", "2.1.29"), false);
    assert.equal(isNewerVersion("1.9.9", "2.0.0"), false);
  });

  test("should return false for malformed versions", () => {
    assert.equal(isNewerVersion("unknown", "2.1.29"), false);
    assert.equal(isNewerVersion("2.1.30", "unknown"), false);
  });
});

describe("When checkForNewVersion runs", () => {
  test("should return the latest version when the registry has a newer one", async () => {
    const latest = await checkForNewVersion("2.1.29", fetchReturning(200, { version: "2.1.31" }));
    assert.equal(latest, "2.1.31");
  });

  test("should return null when already on the latest version", async () => {
    const latest = await checkForNewVersion("2.1.31", fetchReturning(200, { version: "2.1.31" }));
    assert.equal(latest, null);
  });

  test("should return null without fetching when current version is unknown", async () => {
    const calls: CapturedFetch[] = [];
    assert.equal(await checkForNewVersion("unknown", fetchCapturing(calls, 200, {})), null);
    assert.equal(calls.length, 0);
  });

  test("should return null on registry errors instead of throwing", async () => {
    const failingFetch: FetchLike = async () => {
      throw new Error("network down");
    };
    assert.equal(await checkForNewVersion("2.1.29", failingFetch), null);
    assert.equal(await checkForNewVersion("2.1.29", fetchReturning(500, {})), null);
  });

  test("should return null when the registry returns a non-release version", async () => {
    const latest = await checkForNewVersion(
      "2.1.29",
      fetchReturning(200, { version: "2.2.0-beta.1" })
    );
    assert.equal(latest, null);
  });
});

describe("When fetchLatestVersion picks the registry", () => {
  test("should query the public registry anonymously by default", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
    assert.equal(latest, "2.1.31");
    assert.deepEqual(calls, [
      {
        url: "https://registry.npmjs.org/@zereight/mcp-gitlab/latest",
        authorization: null,
        redirect: undefined,
      },
    ]);
  });

  test("should query a configured https registry anonymously", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await fetchLatestVersion(
      fetchCapturing(calls, 200, { version: "2.1.31" }),
      3000,
      "https://npm.internal.example/npm/"
    );
    assert.equal(latest, "2.1.31");
    assert.equal(calls[0]?.url, "https://npm.internal.example/npm/@zereight/mcp-gitlab/latest");
    assert.equal(calls[0]?.authorization, null);
  });

  test("should pass the configured registry through checkForNewVersion", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await checkForNewVersion(
      "2.1.29",
      fetchCapturing(calls, 200, { version: "2.1.31" }),
      "https://npm.internal.example"
    );
    assert.equal(latest, "2.1.31");
    assert.equal(calls[0]?.url, "https://npm.internal.example/@zereight/mcp-gitlab/latest");
  });

  for (const [label, registry] of [
    ["is empty", ""],
    ["is not a URL", "npm.internal.example"],
    ["uses http", "http://npm.internal.example/"],
    ["has no hostname", "https:///"],
    ["has credentials", "https://user:secret@npm.internal.example/"],
    ["has a query string", "https://registry.example/npm?tenant=a"],
    ["has a bare query delimiter", "https://registry.example/npm?"],
    ["has a fragment", "https://registry.example/npm#feed"],
    ["has a bare fragment delimiter", "https://registry.example/npm#"],
  ]) {
    test(`should fall back to the public registry when the configured value ${label}`, async () => {
      const calls: CapturedFetch[] = [];
      const latest = await fetchLatestVersion(
        fetchCapturing(calls, 200, { version: "2.1.31" }),
        3000,
        registry
      );
      assert.equal(latest, "2.1.31");
      assert.equal(calls[0]?.url, "https://registry.npmjs.org/@zereight/mcp-gitlab/latest");
      assert.equal(calls[0]?.authorization, null);
    });
  }
});

const CWD_SECRET_ENV = "GITLAB_MCP_VERSION_CHECK_TEST_SECRET";
const CWD_SECRET = "glpat-version-check-test-secret";
const PUBLIC_LATEST_URL = "https://registry.npmjs.org/@zereight/mcp-gitlab/latest";

type FakeRegistry = {
  origin: string;
  requests: { url: string; authorization: string | null }[];
  close: () => Promise<void>;
};

async function startFakeRegistry(): Promise<FakeRegistry> {
  const requests: FakeRegistry["requests"] = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url ?? "", authorization: req.headers.authorization ?? null });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ version: "99.0.0" }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}

/**
 * Sends requests for the fake registry to it over the network and answers
 * every other URL locally, so the test never reaches the public registry.
 */
function fetchRoutingTo(registry: FakeRegistry, calls: CapturedFetch[]): FetchLike {
  const capture = fetchCapturing(calls, 200, { version: "2.1.31" });
  return async (url, init) => {
    const response = await capture(url, init);
    return url.toString().startsWith(`${registry.origin}/`) ? fetch(url, init) : response;
  };
}

/**
 * Runs `run` with the working directory set to a fresh project whose
 * `.npmrc` is `npmrc`, and with `CWD_SECRET_ENV` set in the environment.
 */
async function inProjectDir(npmrc: string, run: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "gitlab-mcp-project-"));
  const configDir = mkdtempSync(join(tmpdir(), "gitlab-mcp-npmrc-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "some-project", version: "1.0.0", private: true })
  );
  writeFileSync(join(dir, ".npmrc"), npmrc);
  writeFileSync(join(configDir, "user.npmrc"), "");
  writeFileSync(join(configDir, "global.npmrc"), "");

  const keys = [CWD_SECRET_ENV, "NPM_CONFIG_USERCONFIG", "NPM_CONFIG_GLOBALCONFIG", "PATH"];
  const previousEnv = new Map(keys.map(key => [key, process.env[key]]));
  const previousCwd = process.cwd();
  process.env[CWD_SECRET_ENV] = CWD_SECRET;
  process.env.NPM_CONFIG_USERCONFIG = join(configDir, "user.npmrc");
  process.env.NPM_CONFIG_GLOBALCONFIG = join(configDir, "global.npmrc");
  process.chdir(dir);
  try {
    await run(dir);
  } finally {
    process.chdir(previousCwd);
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
    rmSync(configDir, { recursive: true, force: true });
  }
}

describe("When the server starts in a directory with its own .npmrc", () => {
  test("should not send its _authToken or expand environment variables into it", async () => {
    await inProjectDir(
      [
        "@zereight:registry=https://127.0.0.1:9/",
        "registry=https://127.0.0.1:9/",
        `//127.0.0.1:9/:_authToken=\${${CWD_SECRET_ENV}}`,
      ].join("\n"),
      async () => {
        const calls: CapturedFetch[] = [];
        await checkForNewVersion("2.1.29", fetchCapturing(calls, 200, { version: "2.1.31" }));
        assert.equal(calls.length, 1);
        assert.equal(calls[0]?.authorization, null);
        assert.ok(!JSON.stringify(calls).includes(CWD_SECRET));
        assert.equal(calls[0]?.url, PUBLIC_LATEST_URL);
      }
    );
  });

  test("should send no request to the registry it names", async () => {
    const registry = await startFakeRegistry();
    const { host } = new URL(registry.origin);
    try {
      await inProjectDir(
        [
          `@zereight:registry=${registry.origin}/`,
          `registry=${registry.origin}/`,
          `//${host}/:_authToken=\${${CWD_SECRET_ENV}}`,
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          await checkForNewVersion("2.1.29", fetchRoutingTo(registry, calls));
          assert.deepEqual(registry.requests, []);
          assert.deepEqual(
            calls.map(call => call.authorization),
            [null]
          );
          assert.equal(calls[0]?.url, PUBLIC_LATEST_URL);
        }
      );
    } finally {
      await registry.close();
    }
  });

  test(
    "should not run an npm executable found through the working directory",
    { skip: process.platform === "win32" ? "uses a POSIX shell script as npm" : false },
    async () => {
      await inProjectDir("", async dir => {
        // cmd.exe looks up `npm` in the working directory before PATH; put the
        // directory first on PATH to get the same lookup on POSIX.
        const marker = join(dir, "npm-ran.txt");
        const npm = join(dir, "npm");
        writeFileSync(npm, `#!/bin/sh\necho "$@" >> '${marker}'\necho undefined\n`);
        chmodSync(npm, 0o755);
        process.env.PATH = `${dir}${delimiter}${process.env.PATH ?? ""}`;

        const calls: CapturedFetch[] = [];
        await checkForNewVersion("2.1.29", fetchCapturing(calls, 200, { version: "2.1.31" }));
        assert.equal(existsSync(marker) ? readFileSync(marker, "utf8") : "", "");
        assert.equal(calls[0]?.url, PUBLIC_LATEST_URL);
      });
    }
  );
});
