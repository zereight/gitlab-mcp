import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { CliUsageError } from "../../cli/args.js";
import { readSetupOptions, runSetup } from "../../cli/setup.js";

const CLI_ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), "../../build/index.js");
const CLI_TIMEOUT_MS = 30_000;

// Stand-ins for credential text. A refusal must not print any of them.
const FAKE_USER = "alice";
const FAKE_PASSWORD = "Pw7x";
const FAKE_HOST = "gitlab.example";
const AMBIGUOUS_API_URL = `https://${FAKE_USER}:123,https:${FAKE_PASSWORD}@${FAKE_HOST}`;
const ENCODED_API_URL = `https://${FAKE_USER}:p%2Cw@${FAKE_HOST}/api/v4`;
const VALID_LIST = "https://a.example/api/v4,https://b.example/api/v4";

function assertNoUrlSecrets(text: string): void {
  for (const secret of [FAKE_USER, FAKE_PASSWORD, FAKE_HOST, "123"]) {
    assert.equal(text.includes(secret), false, "setup printed part of the API URL");
  }
}

describe("When setup reads flags", () => {
  describe("with both --cursor and --claude", () => {
    it("should reject the combination", () => {
      assert.throws(() => readSetupOptions({ cursor: "true", claude: "true" }), /exactly one/);
    });
  });

  describe("with --cursor", () => {
    it("should build a PAT env that does not embed a token value", () => {
      const options = readSetupOptions({ cursor: "true" });
      const result = runSetup(options);

      assert.match(result.text, /Dry-run/);
      assert.match(result.text, /\$\{env:GITLAB_PERSONAL_ACCESS_TOKEN\}/);
      assert.equal(result.text.includes("glpat-"), false);
    });
  });

  describe("with --claude --oauth", () => {
    it("should print a claude mcp add command", () => {
      const result = runSetup(readSetupOptions({ claude: "true", oauth: "true" }));

      assert.match(result.text, /claude mcp add gitlab/);
      assert.match(result.text, /GITLAB_USE_OAUTH=true/);
    });
  });

  describe("with --cursor --skill", () => {
    it("should print the skill install command without writing", () => {
      const result = runSetup(readSetupOptions({ cursor: "true", skill: "true" }));

      assert.match(result.text, /npx skills add zereight\/gitlab-mcp/);
      assert.equal(result.writtenPath, undefined);
    });
  });
});

describe("When setup writes Cursor config", () => {
  describe("with --write and an existing mcp.json", () => {
    it("should merge the gitlab server without dropping other entries", () => {
      const directory = mkdtempSync(join(tmpdir(), "gitlab-mcp-setup-"));
      const cursorDir = join(directory, ".cursor");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(
        join(cursorDir, "mcp.json"),
        JSON.stringify({ mcpServers: { other: { command: "echo" } } })
      );

      const result = runSetup(readSetupOptions({ cursor: "true", write: "true" }, directory));
      const written = JSON.parse(readFileSync(join(cursorDir, "mcp.json"), "utf8"));

      assert.equal(typeof result.writtenPath, "string");
      assert.equal(written.mcpServers.other.command, "echo");
      assert.equal(written.mcpServers.gitlab.command, "zereight-mcp-gitlab");
    });
  });
});

describe("When setup is given an ambiguous --api-url", () => {
  describe("with a dry-run Cursor snippet", () => {
    it("should refuse before printing the value", () => {
      try {
        runSetup(readSetupOptions({ cursor: "true", api_url: AMBIGUOUS_API_URL }));
        assert.fail("setup should have refused the API URL");
      } catch (error) {
        assert.equal(error instanceof CliUsageError, true, "setup should throw CliUsageError");
        const message = error instanceof Error ? error.message : String(error);
        assert.equal(
          /^--api-url comma 1 of 1 may be inside a username or password/.test(message),
          true,
          "the refusal should name the --api-url comma"
        );
        assert.equal(
          /Write a comma inside a username or password as %2C/.test(message),
          true,
          "the refusal should ask for %2C"
        );
        assertNoUrlSecrets(message);
      }
    });
  });

  describe("with --write and an existing mcp.json", () => {
    it("should leave the file unchanged", () => {
      const directory = mkdtempSync(join(tmpdir(), "gitlab-mcp-setup-"));
      const target = join(directory, ".cursor", "mcp.json");
      mkdirSync(dirname(target), { recursive: true });
      const existing = `${JSON.stringify({ mcpServers: { other: { command: "echo" } } }, null, 2)}\n`;
      writeFileSync(target, existing);

      try {
        runSetup(
          readSetupOptions({ cursor: "true", write: "true", api_url: AMBIGUOUS_API_URL }, directory)
        );
        assert.fail("setup should have refused the API URL");
      } catch (error) {
        assert.equal(error instanceof CliUsageError, true, "setup should throw CliUsageError");
        const message = error instanceof Error ? error.message : String(error);
        assertNoUrlSecrets(message);
      }

      assert.equal(readFileSync(target, "utf8"), existing);
    });
  });
});

describe("When setup is given a valid --api-url", () => {
  describe("with a list that has no username or password", () => {
    it("should print the list in the dry-run snippet", () => {
      const result = runSetup(readSetupOptions({ cursor: "true", api_url: VALID_LIST }));

      assert.match(result.text, /Dry-run/);
      assert.equal(result.text.includes(VALID_LIST), true);
    });
  });

  describe("with a %2C password", () => {
    it("should print the encoded URL and not a decoded comma", () => {
      const result = runSetup(readSetupOptions({ claude: "true", api_url: ENCODED_API_URL }));

      assert.match(result.text, /claude mcp add gitlab/);
      assert.equal(result.text.includes(ENCODED_API_URL), true);
      assert.equal(result.text.includes("p,w"), false);
    });
  });
});

describe("When the built setup CLI runs", () => {
  describe("with --cursor --help", () => {
    it("should print usage on stdout and leave stdout free of JSON-RPC", async () => {
      assert.equal(existsSync(CLI_ENTRY), true, "build/index.js is missing; run npm run build");
      const result = await runBuiltSetup(["setup", "--help"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /zereight-mcp-gitlab setup/);
      assert.equal(result.stdout.includes("{"), false);
    });
  });

  describe("with --cursor", () => {
    it("should dry-run a Cursor snippet that does not embed a token", async () => {
      assert.equal(existsSync(CLI_ENTRY), true, "build/index.js is missing; run npm run build");
      const result = await runBuiltSetup(["setup", "--cursor"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Dry-run/);
      assert.match(result.stdout, /\$\{env:GITLAB_PERSONAL_ACCESS_TOKEN\}/);
      assert.equal(result.stdout.includes("glpat-"), false);
    });
  });

  describe("with an ambiguous --api-url and --write", () => {
    it("should exit 2 without printing the value or writing a file", async () => {
      assert.equal(existsSync(CLI_ENTRY), true, "build/index.js is missing; run npm run build");
      const directory = mkdtempSync(join(tmpdir(), "gitlab-mcp-setup-"));
      const result = await runBuiltSetup([
        "setup",
        "--cursor",
        "--write",
        "--dir",
        directory,
        "--api-url",
        AMBIGUOUS_API_URL,
      ]);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stdout.length === 0, "the refusal should not write to stdout");
      assert.equal(
        /^--api-url comma 1 of 1 may be inside a username or password/.test(result.stderr),
        true,
        "the refusal should name the --api-url comma"
      );
      assertNoUrlSecrets(`${result.stdout}\n${result.stderr}`);
      assert.equal(existsSync(join(directory, ".cursor", "mcp.json")), false);
    });
  });

  describe("with GITLAB_API_URL set to an ambiguous value", () => {
    it("should exit 2 and name the environment variable without printing the value", async () => {
      assert.equal(existsSync(CLI_ENTRY), true, "build/index.js is missing; run npm run build");
      const result = await runBuiltSetup(["setup", "--cursor"], {
        GITLAB_API_URL: AMBIGUOUS_API_URL,
      });

      assert.equal(result.exitCode, 2);
      assert.ok(result.stdout.length === 0, "the refusal should not write to stdout");
      assert.equal(
        /^GITLAB_API_URL comma 1 of 1 may be inside a username or password/.test(result.stderr),
        true,
        "the refusal should name GITLAB_API_URL"
      );
      assertNoUrlSecrets(`${result.stdout}\n${result.stderr}`);
    });
  });

  describe("with a %2C password on --api-url", () => {
    it("should print the encoded URL in the dry-run snippet", async () => {
      assert.equal(existsSync(CLI_ENTRY), true, "build/index.js is missing; run npm run build");
      const result = await runBuiltSetup(["setup", "--cursor", "--api-url", ENCODED_API_URL]);

      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout.includes(ENCODED_API_URL), true);
      assert.equal(result.stdout.includes("p,w"), false);
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

function runBuiltSetup(
  args: readonly string[],
  extraEnv: Readonly<Record<string, string>> = {}
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      env: { ...buildCleanEnv(), ...extraEnv },
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
