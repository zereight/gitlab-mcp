import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PersonalAccessTokenFileError,
  readPersonalAccessTokenFile,
  resolvePersonalAccessToken,
  type PersonalAccessTokenSource,
} from "../personal-access-token.js";

const SERVER_ENTRY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../build/index.js"
);
const INLINE_TOKEN = "glpat-inline-value";
const FILE_TOKEN = "glpat-file-value";
const CLI_TOKEN = "glpat-cli-value";

interface ResolvedToken {
  readonly token: string | undefined;
  readonly warnings: readonly string[];
}

interface ServerRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function isRootUser(): boolean {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

function writeTokenFile(contents: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-pat-file-"));
  const filePath = path.join(directory, "token");
  fs.writeFileSync(filePath, contents, { encoding: "utf8" });
  return filePath;
}

function removeTokenFile(filePath: string): void {
  fs.chmodSync(filePath, 0o600);
  fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
}

function resolveFrom(source: Omit<PersonalAccessTokenSource, "readFile" | "warn">): ResolvedToken {
  const warnings: string[] = [];
  const token = resolvePersonalAccessToken({
    ...source,
    readFile: readPersonalAccessTokenFile,
    warn(message: string): void {
      warnings.push(message);
    },
  });
  return { token, warnings };
}

function loadFailure(
  source: Omit<PersonalAccessTokenSource, "readFile" | "warn">
): PersonalAccessTokenFileError {
  try {
    resolveFrom(source);
  } catch (error: unknown) {
    if (error instanceof PersonalAccessTokenFileError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected PersonalAccessTokenFileError");
}

function childEnv(extra: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.startsWith("GITLAB_") || key === "PORT") {
      continue;
    }
    if (
      key === "SSE" ||
      key === "STREAMABLE_HTTP" ||
      key === "REMOTE_AUTHORIZATION" ||
      key === "LOG_LEVEL" ||
      key === "LOG_FORMAT"
    ) {
      continue;
    }
    env[key] = value;
  }
  env.LOG_LEVEL = "info";
  for (const [key, value] of Object.entries(extra)) {
    env[key] = value;
  }
  return env;
}

function runServerAsync(extra: Readonly<Record<string, string>>): Promise<ServerRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      env: childEnv(extra),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
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
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

describe("When GITLAB_PERSONAL_ACCESS_TOKEN_FILE is set", () => {
  describe("with a token file", () => {
    it("should return the file contents", () => {
      const filePath = writeTokenFile(`${FILE_TOKEN}\n`);
      try {
        const resolved = resolveFrom({
          cliToken: undefined,
          envToken: undefined,
          filePath,
        });
        assert.equal(resolved.token, FILE_TOKEN);
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with surrounding whitespace", () => {
    it("should trim the token", () => {
      const filePath = writeTokenFile(`\n  ${FILE_TOKEN} \t\r\n`);
      try {
        const resolved = resolveFrom({
          cliToken: undefined,
          envToken: undefined,
          filePath,
        });
        assert.equal(resolved.token, FILE_TOKEN);
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with a non-empty inline token", () => {
    it("should return the inline token", () => {
      const resolved = resolveFrom({
        cliToken: undefined,
        envToken: INLINE_TOKEN,
        filePath: path.join(os.tmpdir(), "gitlab-pat-file-missing"),
      });
      assert.equal(resolved.token, INLINE_TOKEN);
    });

    it("should warn that the file is ignored", () => {
      const filePath = path.join(os.tmpdir(), "gitlab-pat-file-missing");
      const resolved = resolveFrom({
        cliToken: undefined,
        envToken: INLINE_TOKEN,
        filePath,
      });
      assert.deepEqual(resolved.warnings, [
        `Ignoring GITLAB_PERSONAL_ACCESS_TOKEN_FILE at ${filePath} because an inline personal access token is set`,
      ]);
    });
  });

  describe("with a missing file", () => {
    it("should fail with ENOENT", () => {
      const filePath = path.join(os.tmpdir(), "gitlab-pat-file-does-not-exist");
      const error = loadFailure({
        cliToken: undefined,
        envToken: undefined,
        filePath,
      });
      assert.equal(error.code, "ENOENT");
      assert.equal(error.filePath, filePath);
    });
  });

  describe("with a file the process cannot read", () => {
    it("should fail with EACCES", { skip: isRootUser() }, () => {
      const filePath = writeTokenFile(FILE_TOKEN);
      fs.chmodSync(filePath, 0o000);
      try {
        const error = loadFailure({
          cliToken: undefined,
          envToken: undefined,
          filePath,
        });
        assert.equal(error.code, "EACCES");
        assert.equal(error.message.includes(FILE_TOKEN), false);
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with an empty file", () => {
    it("should fail with EMPTY", () => {
      const filePath = writeTokenFile("");
      try {
        const error = loadFailure({
          cliToken: undefined,
          envToken: undefined,
          filePath,
        });
        assert.equal(error.code, "EMPTY");
        assert.equal(error.filePath, filePath);
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with a whitespace-only file", () => {
    it("should fail with EMPTY", () => {
      const filePath = writeTokenFile(" \n\t");
      try {
        const error = loadFailure({
          cliToken: undefined,
          envToken: "",
          filePath,
        });
        assert.equal(error.code, "EMPTY");
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with --token and an inline env token", () => {
    it("should return the CLI token", () => {
      const resolved = resolveFrom({
        cliToken: CLI_TOKEN,
        envToken: INLINE_TOKEN,
        filePath: path.join(os.tmpdir(), "gitlab-pat-file-missing"),
      });
      assert.equal(resolved.token, CLI_TOKEN);
    });
  });
});

describe("When the server starts", () => {
  describe("with only a token file and an invalid PORT", () => {
    it("should treat the file as the personal access token", async () => {
      const filePath = writeTokenFile(`${FILE_TOKEN}\n`);
      try {
        const run = await runServerAsync({
          GITLAB_PERSONAL_ACCESS_TOKEN_FILE: filePath,
          PORT: "70000",
        });
        assert.equal(run.code, 1);
        assert.match(run.stderr, /PORT must be between 1 and 65535/);
        assert.equal(
          run.stderr.includes("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set"),
          false
        );
        assert.equal(run.stderr.includes("Either --token"), false);
        assert.equal(run.stderr.includes(FILE_TOKEN), false);
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with an inline token and a token file", () => {
    it("should warn on stderr without the token", async () => {
      const filePath = writeTokenFile(`${FILE_TOKEN}\n`);
      try {
        const run = await runServerAsync({
          GITLAB_PERSONAL_ACCESS_TOKEN: INLINE_TOKEN,
          GITLAB_PERSONAL_ACCESS_TOKEN_FILE: filePath,
          PORT: "70000",
        });
        assert.match(
          run.stderr,
          /Ignoring GITLAB_PERSONAL_ACCESS_TOKEN_FILE at .+ because an inline personal access token is set/
        );
        assert.equal(run.stderr.includes(INLINE_TOKEN), false);
        assert.equal(run.stderr.includes(FILE_TOKEN), false);
      } finally {
        removeTokenFile(filePath);
      }
    });
  });

  describe("with a missing token file", () => {
    it("should exit before serving", async () => {
      const filePath = path.join(os.tmpdir(), "gitlab-pat-file-does-not-exist");
      const run = await runServerAsync({
        GITLAB_PERSONAL_ACCESS_TOKEN_FILE: filePath,
      });
      assert.equal(run.code, 1);
      assert.ok(
        run.stderr.includes(`Cannot load GITLAB_PERSONAL_ACCESS_TOKEN_FILE at ${filePath} (ENOENT)`)
      );
    });
  });

  describe("with no credentials", () => {
    it("should list the credential options and the setup guide", async () => {
      const run = await runServerAsync({});
      assert.equal(run.code, 1);
      assert.ok(
        run.stderr.includes("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set")
      );
      for (const hint of [
        "--token",
        "GITLAB_PERSONAL_ACCESS_TOKEN_FILE",
        "GITLAB_JOB_TOKEN",
        "GITLAB_AUTH_COOKIE_PATH",
        "GITLAB_USE_OAUTH=true",
        "https://zereight.github.io/gitlab-mcp/getting-started/",
      ]) {
        assert.ok(run.stderr.includes(hint), `missing ${hint}`);
      }
    });
  });
});
