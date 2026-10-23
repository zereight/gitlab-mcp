import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readSetupOptions, runSetup } from "../../cli/setup.js";

const CLI_ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), "../../build/index.js");
const CLI_TIMEOUT_MS = 30_000;

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
  args: readonly string[]
): Promise<{ exitCode: number | null; stdout: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      env: buildCleanEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CLI_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    let stdout = "";
    child.stdout.on("data", chunk => {
      stdout += String(chunk);
    });
    child.stderr.resume();
    child.on("error", reject);
    child.on("close", exitCode => {
      resolvePromise({ exitCode, stdout });
    });
  });
}
