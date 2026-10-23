import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { packageVersion, runDoctor, runDoctorWithOptionalProbe } from "../../cli/doctor.js";

const CLI_ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), "../../build/index.js");
const CLI_TIMEOUT_MS = 30_000;

describe("When doctor inspects local configuration", () => {
  describe("with no credentials", () => {
    it("should fail the credentials check without printing a token", () => {
      const report = runDoctor({
        credentials: {
          hasPersonalAccessToken: false,
          hasJobToken: false,
          hasCookie: false,
          useOAuth: false,
        },
        apiUrl: "https://gitlab.com/api/v4",
        permissionMode: "full",
        toolsetsRaw: undefined,
        version: "2.3.7",
      });

      assert.equal(report.ok, false);
      assert.match(report.text, /fail  credentials/);
      assert.equal(report.text.includes("glpat-"), false);
    });
  });

  describe("with a PAT and a web-root API URL", () => {
    it("should fail api_url and keep credentials ok", () => {
      const report = runDoctor({
        credentials: {
          hasPersonalAccessToken: true,
          hasJobToken: false,
          hasCookie: false,
          useOAuth: false,
        },
        apiUrl: "https://gitlab.com",
        permissionMode: "full",
        toolsetsRaw: "core",
        version: "2.3.7",
      });

      assert.equal(report.ok, false);
      assert.match(report.text, /ok  credentials/);
      assert.match(report.text, /fail  api_url/);
      assert.match(report.text, /\/api\/v4/);
    });
  });

  describe("with a valid local config", () => {
    it("should pass without probing the network", () => {
      const report = runDoctor({
        credentials: {
          hasPersonalAccessToken: true,
          hasJobToken: false,
          hasCookie: false,
          useOAuth: false,
        },
        apiUrl: "https://gitlab.example.com/api/v4",
        permissionMode: "readonly",
        toolsetsRaw: "core,wiki",
        version: "2.3.7",
      });

      assert.equal(report.ok, true);
      assert.match(report.text, /ok  toolsets: core,wiki/);
      assert.match(report.text, /ok  version: 2.3.7/);
    });
  });
});

describe("When doctor reads the package version", () => {
  describe("from source or the compiled layout", () => {
    it("should resolve a semver string instead of unknown", () => {
      assert.match(packageVersion(), /^\d+\.\d+\.\d+/);
    });
  });
});

describe("When doctor is asked to probe GitLab", () => {
  describe("with an injected probe", () => {
    it("should append the gitlab_user check", async () => {
      const report = await runDoctorWithOptionalProbe({
        credentials: {
          hasPersonalAccessToken: true,
          hasJobToken: false,
          hasCookie: false,
          useOAuth: false,
        },
        apiUrl: "https://gitlab.example.com/api/v4",
        permissionMode: "full",
        toolsetsRaw: undefined,
        version: "2.3.7",
        probe: async () => ({ ok: true, status: 200, detail: "GET /user 200" }),
      });

      assert.equal(report.ok, true);
      assert.match(report.text, /ok  gitlab_user: GET \/user 200/);
    });
  });
});

describe("When the built doctor CLI runs", () => {
  describe("without credentials", () => {
    it("should print the report on stdout and resolve the package version", async () => {
      assert.equal(existsSync(CLI_ENTRY), true, "build/index.js is missing; run npm run build");
      const result = await runBuiltDoctor();

      assert.equal(result.exitCode, 1);
      assert.match(result.stdout, /fail  credentials/);
      assert.match(result.stdout, /ok  version: \d+\.\d+\.\d+/);
      assert.equal(result.stdout.includes("{"), false);
      assert.equal(result.stdout.includes("glpat-"), false);
    });
  });
});

function buildCleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("GITLAB_")) {
      env[key] = value;
    }
  }
  return env;
}

function runBuiltDoctor(): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, "doctor"], {
      env: buildCleanEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CLI_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += String(chunk);
    });
    child.stderr.on("data", chunk => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", exitCode => {
      resolvePromise({ exitCode, stdout, stderr });
    });
  });
}
