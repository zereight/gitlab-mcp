import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function throwingResolver(): string {
  throw new Error("npm not found");
}

async function withNpmrc(
  contents: string,
  run: () => Promise<void>,
  globalContents = ""
): Promise<void> {
  const configDir = mkdtempSync(join(tmpdir(), "gitlab-mcp-npmrc-"));
  const userconfigPath = join(configDir, ".npmrc");
  const globalconfigPath = join(configDir, "global.npmrc");
  writeFileSync(userconfigPath, contents);
  writeFileSync(globalconfigPath, globalContents);

  const previousUserconfig = process.env.NPM_CONFIG_USERCONFIG;
  const previousGlobalconfig = process.env.NPM_CONFIG_GLOBALCONFIG;
  process.env.NPM_CONFIG_USERCONFIG = userconfigPath;
  process.env.NPM_CONFIG_GLOBALCONFIG = globalconfigPath;
  try {
    await run();
  } finally {
    if (previousUserconfig === undefined) delete process.env.NPM_CONFIG_USERCONFIG;
    else process.env.NPM_CONFIG_USERCONFIG = previousUserconfig;
    if (previousGlobalconfig === undefined) delete process.env.NPM_CONFIG_GLOBALCONFIG;
    else process.env.NPM_CONFIG_GLOBALCONFIG = previousGlobalconfig;
    rmSync(configDir, { recursive: true, force: true });
  }
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

describe("When fetchLatestVersion resolves the registry", () => {
  test("should fetch from the resolved registry instead of a hardcoded one", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await fetchLatestVersion(
      fetchCapturing(calls, 200, { version: "2.1.31" }),
      3000,
      () => "https://npm.internal.example/"
    );
    assert.equal(latest, "2.1.31");
    assert.equal(calls[0]?.url, "https://npm.internal.example/@zereight/mcp-gitlab/latest");
  });

  test("should fall back to the public registry when the resolver throws", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await fetchLatestVersion(
      fetchCapturing(calls, 200, { version: "2.1.31" }),
      3000,
      throwingResolver
    );
    assert.equal(latest, null);
    assert.equal(calls.length, 0);
  });

  test("should fall back to the public registry when the resolved value has no hostname", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await fetchLatestVersion(
      fetchCapturing(calls, 200, { version: "2.1.31" }),
      3000,
      () => "https:///"
    );
    assert.equal(latest, "2.1.31");
    assert.equal(calls[0]?.url, "https://registry.npmjs.org/@zereight/mcp-gitlab/latest");
  });

  test("should fall back to the public registry when the resolved value has a query string", async () => {
    const calls: CapturedFetch[] = [];
    const latest = await fetchLatestVersion(
      fetchCapturing(calls, 200, { version: "2.1.31" }),
      3000,
      () => "https://registry.example/npm?tenant=a"
    );
    assert.equal(latest, "2.1.31");
    assert.equal(calls[0]?.url, "https://registry.npmjs.org/@zereight/mcp-gitlab/latest");
  });
});

describe("When resolving the registry from npm config", () => {
  describe("with a scoped @zereight:registry", () => {
    test("should prefer the scoped registry over the unscoped one", async () => {
      await withNpmrc(
        "registry=https://unscoped.example/\n@zereight:registry=https://scoped.example/\n",
        async () => {
          const calls: CapturedFetch[] = [];
          const latest = await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(latest, "2.1.31");
          assert.equal(calls[0]?.url, "https://scoped.example/@zereight/mcp-gitlab/latest");
        }
      );
    });
  });
});

describe("When fetchLatestVersion authenticates against a protected registry", () => {
  describe("with a scoped _authToken in .npmrc", () => {
    test("should send a Bearer token only to that HTTPS registry", async () => {
      await withNpmrc(
        [
          "registry=https://unscoped.example/",
          "@zereight:registry=https://scoped.example/",
          "//scoped.example/:_authToken=scoped-registry-token",
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          const latest = await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(latest, "2.1.31");
          assert.equal(calls[0]?.url, "https://scoped.example/@zereight/mcp-gitlab/latest");
          assert.equal(calls[0]?.authorization, "Bearer scoped-registry-token");
        }
      );
    });

    test("should refuse to follow redirects when a token is attached", async () => {
      await withNpmrc(
        [
          "@zereight:registry=https://scoped.example/",
          "//scoped.example/:_authToken=scoped-registry-token",
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(calls[0]?.redirect, "error");
        }
      );
    });
  });

  describe("without a matching token", () => {
    test("should omit Authorization", async () => {
      await withNpmrc("@zereight:registry=https://scoped.example/\n", async () => {
        const calls: CapturedFetch[] = [];
        await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
        assert.equal(calls[0]?.authorization, null);
        assert.equal(calls[0]?.redirect, undefined);
      });
    });
  });

  describe("when the token is on a parent registry path", () => {
    test("should fall back to the host-level _authToken", async () => {
      await withNpmrc(
        [
          "@zereight:registry=https://scoped.example/npm",
          "//scoped.example/:_authToken=host-level-token",
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          const latest = await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(latest, "2.1.31");
          assert.equal(calls[0]?.url, "https://scoped.example/npm/@zereight/mcp-gitlab/latest");
          assert.equal(calls[0]?.authorization, "Bearer host-level-token");
        }
      );
    });
  });

  describe("when both a path token and a host token exist", () => {
    test("should prefer the more specific path token", async () => {
      await withNpmrc(
        [
          "@zereight:registry=https://scoped.example/npm",
          "//scoped.example/npm/:_authToken=path-token",
          "//scoped.example/:_authToken=host-level-token",
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(calls[0]?.authorization, "Bearer path-token");
        }
      );
    });
  });

  describe("when the token is only in the global npmrc", () => {
    test("should send a Bearer token from globalconfig", async () => {
      await withNpmrc(
        "@zereight:registry=https://scoped.example/\n",
        async () => {
          const calls: CapturedFetch[] = [];
          await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(calls[0]?.authorization, "Bearer global-registry-token");
        },
        "//scoped.example/:_authToken=global-registry-token\n"
      );
    });
  });

  describe("when the registry path contains underscores", () => {
    test("should send a Bearer token for an Azure Artifacts-style registry path", async () => {
      const registry =
        "https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry";
      const authKey =
        "//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:_authToken";
      await withNpmrc(
        [`@zereight:registry=${registry}`, `${authKey}=azure-feed-token`].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          const latest = await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(latest, "2.1.31");
          assert.equal(
            calls[0]?.url,
            `${registry}/@zereight/mcp-gitlab/latest`
          );
          assert.equal(calls[0]?.authorization, "Bearer azure-feed-token");
        }
      );
    });
  });

  describe("with a token for a different host", () => {
    test("should omit Authorization", async () => {
      await withNpmrc(
        [
          "@zereight:registry=https://scoped.example/",
          "//other.example/:_authToken=other-host-token",
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(calls[0]?.authorization, null);
        }
      );
    });
  });

  describe("when the registry is HTTP", () => {
    test("should omit Authorization even if a token is configured", async () => {
      await withNpmrc(
        [
          "@zereight:registry=http://insecure.example/",
          "//insecure.example/:_authToken=http-registry-token",
        ].join("\n"),
        async () => {
          const calls: CapturedFetch[] = [];
          await fetchLatestVersion(fetchCapturing(calls, 200, { version: "2.1.31" }));
          assert.equal(calls[0]?.url, "http://insecure.example/@zereight/mcp-gitlab/latest");
          assert.equal(calls[0]?.authorization, null);
        }
      );
    });
  });
});
