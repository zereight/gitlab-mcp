import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { AUTH_CLI_HELP } from "../auth-cli.js";
import { parseCliArgs } from "../cli-boolean-flags.js";
import { globalHelpText } from "../cli/help.js";
import {
  deprecatedEnvInputFromSources,
  getDeprecatedEnvWarnings,
  type DeprecatedEnvInput,
} from "../deprecated-env.js";

function warningsFor(overrides: Partial<DeprecatedEnvInput>): string[] {
  return getDeprecatedEnvWarnings({
    useWikiRaw: undefined,
    useMilestoneRaw: undefined,
    usePipelineRaw: undefined,
    ...overrides,
  });
}

describe("When no deprecated env is used", () => {
  describe("with default config", () => {
    test("should emit no warnings", () => {
      assert.deepEqual(warningsFor({}), []);
    });
  });
});

describe("When USE_PIPELINE is enabled", () => {
  describe("with the flag set to true", () => {
    test("should name the CI lint tools the pipelines toolset omits", () => {
      const [warning] = warningsFor({ usePipelineRaw: "true" });
      assert.match(
        warning,
        /Use GITLAB_TOOLSETS=core,pipelines and GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint instead/
      );
    });
  });
});

describe("When legacy toolset flags are enabled", () => {
  describe("with all three flags", () => {
    test("should warn once per flag with its GITLAB_TOOLSETS replacement", () => {
      const warnings = warningsFor({
        useWikiRaw: "true",
        useMilestoneRaw: "true",
        usePipelineRaw: "true",
      });
      assert.equal(warnings.length, 3);
      assert.match(warnings[0], /USE_GITLAB_WIKI.*GITLAB_TOOLSETS=core,wiki/);
      assert.match(warnings[1], /USE_MILESTONE.*GITLAB_TOOLSETS=core,milestones/);
      assert.match(warnings[2], /USE_PIPELINE.*GITLAB_TOOLSETS=core,pipelines/);
    });
  });
});

describe("When a legacy toolset flag is explicitly false", () => {
  describe("with USE_PIPELINE=false", () => {
    test("should keep the CI lint tools in the optional replacement", () => {
      const [warning] = warningsFor({ usePipelineRaw: "false" });
      assert.match(
        warning,
        /Set GITLAB_TOOLSETS=core,pipelines and GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint only if you want those tools in addition to core/
      );
    });
  });

  describe("with USE_GITLAB_WIKI=false", () => {
    test("should warn to remove it without enabling the toolset", () => {
      const [warning, ...rest] = warningsFor({ useWikiRaw: "false" });
      assert.match(warning, /USE_GITLAB_WIKI is set to "false"/);
      assert.match(warning, /does not enable the wiki toolset/);
      assert.match(warning, /GITLAB_TOOLSETS=core,wiki/);
      assert.match(warning, /in addition to core/);
      assert.doesNotMatch(warning, /Use GITLAB_TOOLSETS=core,wiki instead/);
      assert.equal(rest.length, 0);
    });
  });
});

describe("When deprecated settings are passed as empty values", () => {
  describe("with docker-compose interpolating unset variables to empty strings", () => {
    test("should emit no warnings", () => {
      assert.deepEqual(
        warningsFor({
          useWikiRaw: "",
          useMilestoneRaw: "",
          usePipelineRaw: "",
        }),
        []
      );
    });
  });
});

describe("When a deprecated setting comes from a CLI flag", () => {
  describe("with --use-pipeline", () => {
    test("should show the flag and the env var", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        usePipelineFromCli: true,
      });
      assert.match(warning, /`--use-pipeline` \(USE_PIPELINE\)/);
      assert.match(warning, /will be removed in v3\.0\.0/);
    });
  });

  describe("with --use-milestone", () => {
    test("should show the flag and the env var", () => {
      const [warning] = warningsFor({
        useMilestoneRaw: "true",
        useMilestoneFromCli: true,
      });
      assert.match(warning, /`--use-milestone` \(USE_MILESTONE\)/);
    });
  });

  describe("with --use-wiki=false", () => {
    test("should show the flag and say to remove it", () => {
      const [warning] = warningsFor({
        useWikiRaw: "false",
        useWikiFromCli: true,
      });
      assert.match(warning, /`--use-wiki` \(USE_GITLAB_WIKI\) is set to "false"/);
      assert.match(warning, /Remove it/);
    });
  });
});

describe("When GITLAB_TOOLSETS is already set", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should say to add pipelines to the existing list", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsetsRaw: "issues",
      });
      assert.match(warning, /Add `pipelines` to the existing GITLAB_TOOLSETS list \("issues"\)/);
      assert.match(warning, /GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint/);
      assert.doesNotMatch(warning, /GITLAB_TOOLSETS=core,pipelines/);
    });
  });

  describe("with USE_GITLAB_WIKI=false", () => {
    test("should not tell the user to replace the list with core,wiki", () => {
      const [warning] = warningsFor({
        useWikiRaw: "false",
        toolsetsRaw: "issues",
      });
      assert.match(warning, /Add `wiki` to the existing GITLAB_TOOLSETS list \("issues"\)/);
      assert.match(warning, /Remove it/);
      assert.doesNotMatch(warning, /GITLAB_TOOLSETS=core,wiki/);
      assert.doesNotMatch(warning, /in addition to core/);
    });
  });

  describe("with USE_PIPELINE=true and GITLAB_TOOLS already set", () => {
    test("should append the lint tools to the existing list", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsetsRaw: "issues",
        toolsRaw: "list_issues",
      });
      assert.match(warning, /GITLAB_TOOLS=list_issues,validate_ci_lint,validate_project_ci_lint/);
    });
  });
});

describe("When GITLAB_TOOLSETS is all", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should keep all and should not append a toolset", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsetsRaw: "all",
      });
      assert.match(warning, /Keep the existing GITLAB_TOOLSETS value \("all"\)/);
      assert.match(warning, /remove the deprecated setting/);
      assert.doesNotMatch(warning, /all,pipelines/);
      assert.doesNotMatch(warning, /GITLAB_TOOLS=/);
    });
  });

  describe("with --toolsets=ALL", () => {
    test("should name the flag and keep that value", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsetsRaw: "ALL",
        toolsetsFromCli: true,
      });
      assert.match(warning, /Keep the existing --toolsets value \("ALL"\)/);
      assert.doesNotMatch(warning, /all,pipelines/);
      assert.doesNotMatch(warning, /GITLAB_TOOLS=/);
    });
  });
});

describe("When GITLAB_TOOLSETS is all,issues", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should append pipelines because the value is not all", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsetsRaw: "all,issues",
      });
      assert.match(
        warning,
        /Add `pipelines` to the existing GITLAB_TOOLSETS list \("all,issues"\)/
      );
    });
  });
});

describe("When --tools supplies the tool list", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should tell the user to append the lint tools to that flag", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsRaw: "list_issues",
        toolsFromCli: true,
      });
      assert.match(warning, /--tools=list_issues,validate_ci_lint,validate_project_ci_lint/);
      assert.doesNotMatch(warning, /GITLAB_TOOLS=/);
    });
  });
});

describe("When --toolsets supplies the toolset list", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should tell the user to add pipelines to that flag", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsetsRaw: "issues",
        toolsetsFromCli: true,
        toolsRaw: "list_issues",
        toolsFromCli: true,
      });
      assert.match(warning, /existing --toolsets list \("issues"\)/);
      assert.match(warning, /--tools=list_issues,validate_ci_lint,validate_project_ci_lint/);
      assert.doesNotMatch(warning, /GITLAB_TOOLSETS/);
      assert.doesNotMatch(warning, /GITLAB_TOOLS=/);
    });
  });
});

describe("When GITLAB_TOOLS is already set and GITLAB_TOOLSETS is not", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should keep core in the toolset hint and append the lint tools", () => {
      const [warning] = warningsFor({
        usePipelineRaw: "true",
        toolsRaw: "list_issues",
      });
      assert.match(
        warning,
        /Use GITLAB_TOOLSETS=core,pipelines and GITLAB_TOOLS=list_issues,validate_ci_lint,validate_project_ci_lint instead/
      );
    });
  });
});

describe("When deprecated env warnings are returned", () => {
  describe("with USE_* flags", () => {
    test("should end every warning with the migration notice", () => {
      const warnings = [
        ...warningsFor({ useWikiRaw: "true", useMilestoneRaw: "true", usePipelineRaw: "true" }),
        ...warningsFor({ useWikiRaw: "false", useMilestoneRaw: "no", usePipelineRaw: "false" }),
      ];
      const suffix =
        " See https://github.com/zereight/gitlab-mcp/issues/815 for migration details.";
      assert.equal(
        warnings.length >= 6 && warnings.every(warning => warning.endsWith(suffix)),
        true
      );
    });
  });
});

describe("When a deprecated env var is scheduled for removal", () => {
  describe("with USE_PIPELINE enabled", () => {
    test("should name v3.0.0", () => {
      const [warning] = warningsFor({ usePipelineRaw: "true" });
      assert.match(warning, /will be removed in v3\.0\.0/);
      assert.doesNotMatch(warning, /next major version/);
    });
  });
});

const SERVER_PATH = path.resolve("build/index.js");

function spawnEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GITLAB_DISABLE_VERSION_CHECK: "true",
    ...overrides,
  };
}

function requireBuiltServer(): void {
  assert.equal(existsSync(SERVER_PATH), true, "build/index.js is missing; run npm run build");
}

interface CapturedProcess {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runBuiltServer(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options?: {
    readonly stdin?: string;
    readonly stopWhen?: (captured: { readonly stdout: string; readonly stderr: string }) => boolean;
  }
): Promise<CapturedProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_PATH, ...args], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 30000);
    const maybeStop = () => {
      if (options?.stopWhen === undefined) {
        return;
      }
      const captured = {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      };
      if (!options.stopWhen(captured)) {
        return;
      }
      child.kill("SIGTERM");
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      maybeStop();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      maybeStop();
    });
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
    if (options?.stdin !== undefined) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}

function hasCompleteInitializeResponse(stdout: string): boolean {
  const finishedLines = stdout.endsWith("\n")
    ? stdout.split("\n").filter(line => line.length > 0)
    : stdout.split("\n").slice(0, -1);
  return finishedLines.some(line => {
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return false;
      }
      return "jsonrpc" in parsed && parsed.jsonrpc === "2.0" && "id" in parsed && parsed.id === 1;
    } catch {
      return false;
    }
  });
}

function isJsonRpcMessage(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return "jsonrpc" in value && value.jsonrpc === "2.0";
}

function assertStdoutIsJsonRpc(stdout: string): void {
  const lines = stdout.split("\n").filter(line => line.trim() !== "");
  assert.ok(lines.length > 0);
  for (const line of lines) {
    const parsed: unknown = JSON.parse(line);
    assert.equal(isJsonRpcMessage(parsed), true);
  }
}

describe("When deprecatedEnvInputFromSources reads a command snapshot", () => {
  describe("with a CLI flag and a conflicting injected env", () => {
    test("should use the CLI value", () => {
      const input = deprecatedEnvInputFromSources(parseCliArgs(["auth", "--use-pipeline=false"]), {
        USE_PIPELINE: "true",
      });

      assert.equal(input.usePipelineRaw, "false");
      assert.equal(input.usePipelineFromCli, true);
    });
  });

  describe("with GITLAB_TOOLS only in the injected env", () => {
    test("should copy that tools list", () => {
      const input = deprecatedEnvInputFromSources(parseCliArgs(["auth"]), {
        GITLAB_TOOLS: "list_issues",
      });

      assert.equal(input.toolsRaw, "list_issues");
    });
  });
});

describe("When configuration validation fails", () => {
  describe("with a CLI flag and no credentials", () => {
    test("should print the deprecation warning on stderr before the missing-token exit", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(["--use-wiki=false", "--use-pipeline"], spawnEnv({}));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /`--use-wiki` \(USE_GITLAB_WIKI\)/);
      assert.match(result.stderr, /Remove it/);
      assert.match(result.stderr, /`--use-pipeline` \(USE_PIPELINE\)/);
      assert.match(result.stderr, /will be removed in v3\.0\.0/);
      const warningAt = result.stderr.indexOf("`--use-wiki`");
      const failedAt = result.stderr.indexOf(
        "GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set"
      );
      assert.ok(warningAt >= 0);
      assert.ok(failedAt > warningAt);
      assert.equal(result.code, 1);
    });
  });

  describe("with an invalid PORT and a deprecated env var", () => {
    test("should print the warning before configuration validation fails", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(
        [],
        spawnEnv({
          GITLAB_PERSONAL_ACCESS_TOKEN: "dummy",
          GITLAB_API_URL: "https://gitlab.example.com/api/v4",
          USE_PIPELINE: "true",
          PORT: "70000",
        })
      );
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /USE_PIPELINE is deprecated and will be removed in v3\.0\.0/);
      const warningAt = result.stderr.indexOf("USE_PIPELINE is deprecated");
      const failedAt = result.stderr.indexOf("Configuration validation failed");
      assert.ok(warningAt >= 0);
      assert.ok(failedAt > warningAt);
      assert.match(result.stderr, /PORT must be between 1 and 65535/);
      assert.equal(result.code, 1);
    });
  });

  describe("with GITLAB_TOOLSETS already set", () => {
    test("should tell the user to add pipelines to that list", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(
        [],
        spawnEnv({
          USE_PIPELINE: "true",
          GITLAB_TOOLSETS: "issues",
        })
      );
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /Add `pipelines` to the existing GITLAB_TOOLSETS list \("issues"\)/
      );
      assert.doesNotMatch(result.stderr, /GITLAB_TOOLSETS=core,pipelines/);
      const warningAt = result.stderr.indexOf("Add `pipelines`");
      const failedAt = result.stderr.indexOf(
        "GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set"
      );
      assert.ok(failedAt > warningAt);
    });
  });
});

describe("When the human CLI runs", () => {
  describe("with the tool subcommand and --use-pipeline", () => {
    test("should write the warning to stderr and leave stdout empty", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(
        ["--use-pipeline", "tool", "list_projects"],
        spawnEnv({})
      );
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /`--use-pipeline` \(USE_PIPELINE\)/);
      assert.match(result.stderr, /will be removed in v3\.0\.0/);
      assert.doesNotMatch(result.stdout, /deprecated/);
    });
  });

  describe("with a group command and --use-wiki=false", () => {
    test("should write the warning to stderr and leave stdout empty", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(["--use-wiki=false", "project", "list"], spawnEnv({}));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /`--use-wiki` \(USE_GITLAB_WIKI\)/);
      assert.match(result.stderr, /Remove it/);
      assert.doesNotMatch(result.stdout, /deprecated/);
    });
  });
});

describe("When --help is requested", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should write the warning to stderr and only the help text to stdout", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(["--help"], spawnEnv({ USE_PIPELINE: "true" }));
      assert.equal(result.code, 0);
      assert.equal(result.stdout, globalHelpText());
      assert.match(result.stderr, /USE_PIPELINE is deprecated and will be removed in v3\.0\.0/);
    });
  });
});

describe("When auth --help is requested", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should write the warning to stderr and the auth help text to stdout", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(["auth", "--help"], spawnEnv({ USE_PIPELINE: "true" }));
      assert.equal(result.code, 0);
      assert.equal(result.stdout, AUTH_CLI_HELP);
      assert.match(result.stderr, /USE_PIPELINE is deprecated and will be removed in v3\.0\.0/);
    });
  });
});

describe("When the auth CLI runs", () => {
  describe("with USE_MILESTONE=false", () => {
    test("should write the warning to stderr and leave stdout empty", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(["auth"], spawnEnv({ USE_MILESTONE: "false" }));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /USE_MILESTONE is set to "false"/);
      assert.match(result.stderr, /Remove it/);
      assert.doesNotMatch(result.stdout, /deprecated/);
    });
  });

  describe("with --use-milestone", () => {
    test("should name the flag on stderr only", async () => {
      requireBuiltServer();
      const result = await runBuiltServer(["--use-milestone", "auth"], spawnEnv({}));
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /`--use-milestone` \(USE_MILESTONE\)/);
    });
  });
});

describe("When the stdio server handles initialize", () => {
  describe("with USE_PIPELINE=true", () => {
    test("should keep stdout to JSON-RPC and write the warning to stderr", async () => {
      requireBuiltServer();
      const initialize =
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "deprecated-env-test", version: "0.0.0" },
          },
        }) + "\n";
      const result = await runBuiltServer(
        [],
        spawnEnv({
          GITLAB_PERSONAL_ACCESS_TOKEN: "dummy",
          GITLAB_API_URL: "https://gitlab.example.com/api/v4",
          USE_PIPELINE: "true",
        }),
        {
          stdin: initialize,
          stopWhen: captured =>
            hasCompleteInitializeResponse(captured.stdout) &&
            captured.stderr.includes("USE_PIPELINE is deprecated"),
        }
      );
      assertStdoutIsJsonRpc(result.stdout);
      assert.match(result.stderr, /USE_PIPELINE is deprecated and will be removed in v3\.0\.0/);
      assert.match(result.stderr, /GITLAB_TOOLSETS=core,pipelines/);
      assert.doesNotMatch(result.stdout, /deprecated/);
      assert.doesNotMatch(result.stdout, /USE_PIPELINE/);
    });
  });
});
