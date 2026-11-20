import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { parseArgv, parseToolArgs } from "../../cli/args.js";
import { buildToolReplay, SECRET_ARGUMENT_NAMES, type ToolReplay } from "../../cli/replay-command.js";
import { allTools } from "../../tools/registry.js";
import {
  assertOnlyBinaryRan,
  hasMarker,
  parsePortableCommand,
  PWSH_PATH,
  runInEveryShell,
  runInPwsh,
  runInShell,
  SKIP_WITHOUT_PWSH,
  type StubWorkspace,
  withStubWorkspace,
} from "./shell-replay-harness.js";

const BINARY = "zereight-mcp-gitlab";
// Each payload would create this file in the workspace if a shell ran it.
const MARKER = "PWNED";
// Every `cli` line is made of these characters only.
const PORTABLE_CLI = /^[A-Za-z0-9 ._:/=+,"-]+$/;

// POSIX shell syntax: these values get no `cli` line, only `cli_argv`.
const POSIX_SYNTAX_VALUES = [
  `x$(touch ${MARKER})`,
  `x\`touch ${MARKER}\``,
  "$HOME",
  "${HOME}",
  `a;touch ${MARKER}`,
  `a|touch ${MARKER}`,
  `a&&touch ${MARKER}`,
  "line one\nline two",
  "trailing newline\n",
  "it's",
  `a'$(touch ${MARKER})'b`,
  `a"b$(touch ${MARKER})"c`,
  "back\\slash",
  "café 😀 日本語",
  "*",
  "~",
  "",
];

// cmd.exe and PowerShell syntax, including what POSIX single quotes do not cover
// there: these values get no `cli` line, only `cli_argv`.
const CMD_AND_POWERSHELL_VALUES = [
  "x & echo INJECTED > marker & rem ",
  "a|b",
  "a<b",
  "a>b",
  "a^b",
  "%PATH%",
  "!PATH!",
  'a"b',
  "a`b",
  `$(New-Item ${MARKER})`,
  "a(b)",
  "a;b",
  `x' ; New-Item ${MARKER} ; '`,
  "--%",
  "a --% b",
  "a\nb",
  "a\tb",
  "a\rb",
  "a\u0007b",
  "a\u007fb",
  "{a}",
  "[a]",
  "a?",
  "#a",
  "@a",
  // PowerShell reads these Unicode characters as quotes and dashes.
  `x‘ ; New-Item ${MARKER} ; ’`,
  `x“$(New-Item ${MARKER})”`,
  "‚x‛",
  "„x",
  "––api-url",
  "—x",
  "a b",
  "café",
  "日本語",
];

const ARGV_ONLY_VALUES = [...POSIX_SYNTAX_VALUES, ...CMD_AND_POWERSHELL_VALUES];

// Values that read the same in sh, cmd.exe and PowerShell, bare or in double quotes.
const PORTABLE_VALUES = [
  "-leading-dash",
  "--api-url=https://evil.example",
  "-",
  "  padded  ",
  "foo bar",
  "a,b",
  "- a",
  "-x, y",
  "Fix login, again",
  "src/app.ts",
  "path with space/file.ts",
  "v1.2.3",
  "a=b",
  "x:y",
  "1e+21",
];

function schemaFor(toolName: string): unknown {
  const tool = allTools.find(entry => entry.name === toolName);
  assert.ok(tool, `unknown registry tool ${toolName}`);
  return tool.inputSchema;
}

// Parses the argv the binary would receive the way the real CLI does. A replay
// that a shell splits differently, or that the parser reads as a flag, fails here.
function parseReplayArgv(argv: readonly string[], toolName: string): Record<string, unknown> {
  const parsed = parseArgv(["node", BINARY, ...argv]);
  assert.deepEqual(parsed.positionals, ["tool", toolName]);
  return parseToolArgs({
    schema: schemaFor(toolName),
    flags: parsed.toolFlags,
    argsJson: parsed.argsJson,
    extraArgs: undefined,
  });
}

/** The argv (without the binary name) a replay hands the CLI: shells run `cli`, `cli_argv` is taken as is. */
function replayArgv(replay: ToolReplay | undefined, workspace: StubWorkspace): readonly string[] {
  assert.ok(replay !== undefined, "the arguments must still produce a replay");
  assert.equal(Object.keys(replay).length, 1, "a replay carries cli or cli_argv, never both");
  if ("cli" in replay) {
    assert.match(replay.cli, PORTABLE_CLI);
    return runInEveryShell(replay.cli, workspace);
  }
  assert.equal(replay.cli_argv[0], BINARY);
  return replay.cli_argv.slice(1);
}

function searchFlag(value: string): string[] {
  return value.startsWith("-") ? [`--search=${value}`] : ["--search", value];
}

describe("When buildToolReplay prints a CLI invocation", () => {
  describe("with scalar tool arguments", () => {
    it("should emit kebab-case flags without the token", () => {
      const replay = buildToolReplay(
        "list_issues",
        { project_id: "123", state: "opened", token: "glpat-secret" },
        schemaFor("list_issues")
      );

      assert.deepEqual(replay, { cli: "zereight-mcp-gitlab tool list_issues --project-id 123 --state opened" });
    });

    it("should keep numbers and booleans readable", () => {
      const replay = buildToolReplay(
        "list_issues",
        { project_id: "123", per_page: 20, confidential: true },
        schemaFor("list_issues")
      );

      assert.deepEqual(replay, {
        cli: "zereight-mcp-gitlab tool list_issues --project-id 123 --per-page 20 --confidential true",
      });
    });

    it("should attach a value that starts with a dash in = form so the CLI does not read it as a flag", () => {
      const replay = buildToolReplay(
        "list_issues",
        { project_id: "123", per_page: -5, search: "-x" },
        schemaFor("list_issues")
      );

      assert.deepEqual(replay, { cli: "zereight-mcp-gitlab tool list_issues --project-id 123 --per-page=-5 --search=-x" });
    });

    it("should double-quote a value with spaces or commas", () => {
      const replay = buildToolReplay(
        "list_issues",
        { project_id: "123", search: "foo bar", milestone: "v1,beta" },
        schemaFor("list_issues")
      );

      assert.deepEqual(replay, {
        cli: 'zereight-mcp-gitlab tool list_issues --project-id 123 --search "foo bar" --milestone "v1,beta"',
      });
    });

    it("should double-quote the value part of a dash-leading value with a space", () => {
      const replay = buildToolReplay("list_issues", { project_id: "123", search: "- a" }, schemaFor("list_issues"));

      assert.deepEqual(replay, { cli: 'zereight-mcp-gitlab tool list_issues --project-id 123 --search="- a"' });
    });
  });

  describe("with a nested object", () => {
    it("should pass it through --args-json in cli_argv, since JSON cannot go in a portable line", () => {
      const replay = buildToolReplay(
        "execute_graphql",
        { query: "{ currentUser { id } }", variables: { n: 1 } },
        schemaFor("execute_graphql")
      );

      assert.deepEqual(replay, {
        cli_argv: [
          BINARY,
          "tool",
          "execute_graphql",
          "--query",
          "{ currentUser { id } }",
          "--args-json",
          '{"variables":{"n":1}}',
        ],
      });
    });

    it("should use cli_argv even when every scalar is a plain word", () => {
      const replay = buildToolReplay(
        "list_issues",
        { project_id: "123", labels: ["bug"] },
        schemaFor("list_issues")
      );

      assert.deepEqual(replay, {
        cli_argv: [BINARY, "tool", "list_issues", "--project-id", "123", "--args-json", '{"labels":["bug"]}'],
      });
    });
  });

  describe("with confirmation metadata", () => {
    it("should omit _confirmed", () => {
      const replay = buildToolReplay("push_files", { project_id: "1", _confirmed: true }, schemaFor("push_files"));

      assert.deepEqual(replay, { cli: "zereight-mcp-gitlab tool push_files --project-id 1" });
    });
  });
});

describe("When a tool argument value can be written the same way for sh, cmd.exe and PowerShell", () => {
  for (const value of PORTABLE_VALUES) {
    it(`should print a cli line that every shell reads as one exact argument: ${JSON.stringify(value)}`, () => {
      withStubWorkspace(workspace => {
        const args = { project_id: "123", search: value };
        const replay = buildToolReplay("list_issues", args, schemaFor("list_issues"));
        assert.ok(replay !== undefined && "cli" in replay, `expected a cli line, got ${JSON.stringify(replay)}`);

        const argv = replayArgv(replay, workspace);
        assert.deepEqual(argv, ["tool", "list_issues", "--project-id", "123", ...searchFlag(value)]);
        assert.deepEqual(parseReplayArgv(argv, "list_issues"), args);
      });
    });
  }
});

describe("When a tool argument value contains shell syntax", () => {
  for (const value of ARGV_ONLY_VALUES) {
    it(`should carry it in cli_argv, with no cli line: ${JSON.stringify(value)}`, () => {
      const args = { project_id: "123", search: value };
      const replay = buildToolReplay("list_issues", args, schemaFor("list_issues"));

      assert.deepEqual(replay, {
        cli_argv: [BINARY, "tool", "list_issues", "--project-id", "123", ...searchFlag(value)],
      });
      assert.deepEqual(parseReplayArgv(replay.cli_argv.slice(1), "list_issues"), args);
    });
  }

  it("should not print a line for a value that is PowerShell's stop-parsing token --%", () => {
    const replay = buildToolReplay("list_issues", { project_id: "123", search: "--%" }, schemaFor("list_issues"));

    assert.deepEqual(replay, { cli_argv: [BINARY, "tool", "list_issues", "--project-id", "123", "--search=--%"] });
  });

  it("should round-trip nested values through --args-json in cli_argv", () => {
    withStubWorkspace(workspace => {
      const args = {
        project_id: "123",
        search: "ok",
        labels: [`it's $(touch ${MARKER})`, "`touch " + MARKER + "`", "a & b", "%PATH%"],
      };
      const replay = buildToolReplay("list_issues", args, schemaFor("list_issues"));
      assert.ok(replay !== undefined && "cli_argv" in replay);

      assert.deepEqual(parseReplayArgv(replayArgv(replay, workspace), "list_issues"), args);
    });
  });

  it("should round-trip a GraphQL document and variables containing quotes and command substitution", () => {
    withStubWorkspace(workspace => {
      const args = {
        query: `query($id: ID!) { node(id: "it's $(touch ${MARKER})") { id } }`,
        variables: { id: "a'b" },
      };
      const replay = buildToolReplay("execute_graphql", args, schemaFor("execute_graphql"));
      assert.ok(replay !== undefined && "cli_argv" in replay);

      assert.deepEqual(parseReplayArgv(replayArgv(replay, workspace), "execute_graphql"), args);
    });
  });

  it("should omit the replay when a string carries a NUL byte, which argv cannot hold", () => {
    const replay = buildToolReplay("list_issues", { project_id: "123", search: "a\u0000b" }, schemaFor("list_issues"));
    assert.equal(replay, undefined);
  });

  it("should omit the replay when a string carries an unpaired surrogate", () => {
    const replay = buildToolReplay("list_issues", { project_id: "123", search: "a\uD800b" }, schemaFor("list_issues"));
    assert.equal(replay, undefined);
  });
});

describe("When PowerShell runs the POSIX single-quoted form of a value", () => {
  it("should run the code after a single quote, which is why that value gets no cli line", { skip: SKIP_WITHOUT_PWSH }, () => {
    withStubWorkspace(workspace => {
      const value = `x' ; New-Item ${MARKER} ; '`;
      const posixQuoted = `'${value.replace(/'/g, "'\\''")}'`;
      const line = `${BINARY} tool list_issues --project-id 123 --search ${posixQuoted}`;

      // sh reads the single-quoted form as one argument...
      assert.deepEqual(runInShell(line, workspace), ["tool", "list_issues", "--project-id", "123", "--search", value]);
      assert.equal(hasMarker(workspace, MARKER), false);
      // ...PowerShell does not, so the harness can tell the two apart.
      runInPwsh([line], workspace);
      assert.equal(hasMarker(workspace, MARKER), true, "pwsh should have run New-Item from the value");

      const replay = buildToolReplay("list_issues", { project_id: "123", search: value }, schemaFor("list_issues"));
      assert.deepEqual(replay, {
        cli_argv: [BINARY, "tool", "list_issues", "--project-id", "123", "--search", value],
      });
    });
  });
});

describe("When an argument name or tool name is not a plain identifier", () => {
  const UNSAFE_KEYS = [
    `$(touch ${MARKER}KEY)`,
    `a;touch ${MARKER}KEY`,
    "x`touch " + MARKER + "KEY`",
    "a&b",
    "a%b",
    "project id",
    "Project_ID",
    "projéct_id",
    // Not tool arguments, but the CLI reads them as global flags from the same argv.
    "api_url",
    "http_proxy",
    "ca_cert_path",
    "output",
  ];

  for (const key of UNSAFE_KEYS) {
    it(`should omit the replay, with neither cli nor cli_argv, for argument name ${JSON.stringify(key)}`, () => {
      const replay = buildToolReplay("list_issues", { project_id: "123", [key]: "1" }, schemaFor("list_issues"));
      assert.equal(replay, undefined, "an unsafe argument name must drop the replay");
    });
  }

  it("should omit the replay for a tool name with shell syntax", () => {
    const replay = buildToolReplay(`list_issues$(touch ${MARKER})`, { project_id: "123" }, schemaFor("list_issues"));
    assert.equal(replay, undefined);
  });
});

describe("When replaying every registry tool", () => {
  it("should round-trip shell-syntax values for each schema property through the CLI parser", () => {
    sweepRegistry([...ARGV_ONLY_VALUES, ...PORTABLE_VALUES]);
  });

  it("should print a portable cli line for each tool whose values are all portable scalars", () => {
    const lines = sweepRegistry(PORTABLE_VALUES);
    assert.ok(lines > 0, "the sweep printed no cli line");
  });
});

/** Replays sample arguments for every registry tool; returns how many replays were cli lines. */
function sweepRegistry(values: readonly string[]): number {
  return withStubWorkspace(workspace => {
    const failures: string[] = [];
    const lines: { tool: string; cli: string; argv: readonly string[] }[] = [];
    for (const tool of allTools) {
      const schema = tool.inputSchema as {
        properties?: Record<string, { type?: unknown }>;
        required?: string[];
      };
      // Secret arguments are never replayed by design, so a tool that requires one
      // cannot be replayed and is outside this sweep.
      if ((schema.required ?? []).some(key => SECRET_ARGUMENT_NAMES.has(key))) {
        continue;
      }
      const properties = Object.entries(schema.properties ?? {}).filter(([key]) => !SECRET_ARGUMENT_NAMES.has(key));
      if (properties.length === 0) {
        continue;
      }
      const args: Record<string, unknown> = {};
      properties.forEach(([key, property], index) => {
        args[key] = sampleValue(property.type, values[index % values.length]);
      });

      const replay = buildToolReplay(tool.name, args, tool.inputSchema);
      if (replay === undefined) {
        failures.push(`${tool.name}: no replay for schema properties`);
        continue;
      }
      try {
        let argv: readonly string[];
        if ("cli" in replay) {
          assert.equal("cli_argv" in replay, false);
          argv = parsePortableCommand(replay.cli).slice(1);
          assert.deepEqual(runInShell(replay.cli, workspace), argv, "sh read the line differently");
          lines.push({ tool: tool.name, cli: replay.cli, argv });
        } else {
          assert.equal(replay.cli_argv[0], BINARY);
          argv = replay.cli_argv.slice(1);
        }
        assert.deepEqual(parseReplayArgv(argv, tool.name), args);
      } catch (error) {
        failures.push(`${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (PWSH_PATH !== undefined && lines.length > 0) {
      const results = runInPwsh(
        lines.map(line => line.cli),
        workspace
      );
      results.forEach((argv, index) => {
        if (!isDeepStrictEqual(argv, lines[index].argv)) {
          failures.push(`${lines[index].tool}: pwsh read ${lines[index].cli} as ${JSON.stringify(argv)}`);
        }
      });
    }
    assertOnlyBinaryRan(workspace);
    assert.deepEqual(failures, []);
    return lines.length;
  });
}

function sampleValue(type: unknown, text: string): unknown {
  const types = (Array.isArray(type) ? type : [type]).filter(entry => entry !== "null");
  // The CLI coerces a flag only when its schema type is a single scalar, so a
  // multi-type property round-trips as a string, the same as a free-text value.
  if (types.length === 1 && (types[0] === "number" || types[0] === "integer")) {
    return 7;
  }
  if (types.length === 1 && types[0] === "boolean") {
    return true;
  }
  if (types.includes("array")) {
    return [text];
  }
  if (types.includes("object")) {
    return { key: text };
  }
  return text;
}
