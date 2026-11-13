import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgv, parseToolArgs } from "../../cli/args.js";
import { buildToolReplayCommand, SECRET_ARGUMENT_NAMES } from "../../cli/replay-command.js";
import { allTools } from "../../tools/registry.js";
import { hasMarker, runInShell, withStubWorkspace } from "./shell-replay-harness.js";

// Each payload would create this file in the workspace if the shell ran it.
const MARKER = "PWNED";

const HOSTILE_VALUES = [
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
  "-leading-dash",
  "--api-url=https://evil.example",
  "-",
  "café 😀 日本語",
  "*",
  "~",
  "",
  "  padded  ",
];

function schemaFor(toolName: string): unknown {
  const tool = allTools.find(entry => entry.name === toolName);
  assert.ok(tool, `unknown registry tool ${toolName}`);
  return tool.inputSchema;
}

// Parses the argv the stub received the way the real CLI does. A replay that the
// shell splits differently, or that the parser reads as a flag, fails here.
function parseReplayArgv(argv: readonly string[], toolName: string): Record<string, unknown> {
  const parsed = parseArgv(["node", "zereight-mcp-gitlab", ...argv]);
  assert.deepEqual(parsed.positionals, ["tool", toolName]);
  return parseToolArgs({
    schema: schemaFor(toolName),
    flags: parsed.toolFlags,
    argsJson: parsed.argsJson,
    extraArgs: undefined,
  });
}

describe("When buildToolReplayCommand prints a CLI invocation", () => {
  describe("with scalar tool arguments", () => {
    it("should emit kebab-case flags without the token", () => {
      const command = buildToolReplayCommand(
        "list_issues",
        { project_id: "123", state: "opened", token: "glpat-secret" },
        schemaFor("list_issues")
      );

      assert.equal(command, "zereight-mcp-gitlab tool list_issues --project-id 123 --state opened");
    });

    it("should keep numbers and booleans readable", () => {
      const command = buildToolReplayCommand(
        "list_issues",
        { project_id: "123", per_page: 20, confidential: true },
        schemaFor("list_issues")
      );

      assert.equal(command, "zereight-mcp-gitlab tool list_issues --project-id 123 --per-page 20 --confidential true");
    });

    it("should attach a value that starts with a dash in = form so the CLI does not read it as a flag", () => {
      const command = buildToolReplayCommand(
        "list_issues",
        { project_id: "123", per_page: -5, search: "-x" },
        schemaFor("list_issues")
      );

      assert.equal(command, "zereight-mcp-gitlab tool list_issues --project-id 123 --per-page=-5 --search=-x");
    });
  });

  describe("with a nested object", () => {
    it("should pass it through --args-json", () => {
      const command = buildToolReplayCommand(
        "execute_graphql",
        { query: "{ currentUser { id } }", variables: { n: 1 } },
        schemaFor("execute_graphql")
      );

      assert.ok(command !== undefined);
      assert.match(command, /tool execute_graphql/);
      assert.match(command, /--query/);
      assert.match(command, /--args-json/);
      assert.equal(command.includes("glpat"), false);
    });
  });

  describe("with confirmation metadata", () => {
    it("should omit _confirmed", () => {
      const command = buildToolReplayCommand(
        "push_files",
        { project_id: "1", _confirmed: true },
        schemaFor("push_files")
      );

      assert.ok(command !== undefined);
      assert.equal(command.includes("_confirmed"), false);
      assert.match(command, /--project-id 1/);
    });
  });
});

describe("When a tool argument value contains shell syntax", () => {
  for (const value of HOSTILE_VALUES) {
    it(`should reach the tool as one exact argument: ${JSON.stringify(value)}`, () => {
      withStubWorkspace(workspace => {
        const command = buildToolReplayCommand(
          "list_issues",
          { project_id: "123", search: value },
          schemaFor("list_issues")
        );
        assert.ok(command !== undefined, "a safe value must still produce a replay");

        const argv = runInShell(command, workspace);
        assert.ok(argv !== undefined, "the replay must invoke the binary");
        assert.equal(hasMarker(workspace, MARKER), false, "the shell executed injected code");
        assert.deepEqual(parseReplayArgv(argv, "list_issues"), { project_id: "123", search: value });
      });
    });
  }

  it("should round-trip nested values through --args-json without shell expansion", () => {
    withStubWorkspace(workspace => {
      const args = {
        project_id: "123",
        search: "ok",
        labels: [`it's $(touch ${MARKER})`, "`touch " + MARKER + "`"],
      };
      const command = buildToolReplayCommand("list_issues", args, schemaFor("list_issues"));
      assert.ok(command !== undefined);

      const argv = runInShell(command, workspace);
      assert.ok(argv !== undefined);
      assert.equal(hasMarker(workspace, MARKER), false);
      assert.deepEqual(parseReplayArgv(argv, "list_issues"), args);
    });
  });

  it("should round-trip a GraphQL document and variables containing quotes and command substitution", () => {
    withStubWorkspace(workspace => {
      const args = {
        query: `query($id: ID!) { node(id: "it's $(touch ${MARKER})") { id } }`,
        variables: { id: "a'b" },
      };
      const command = buildToolReplayCommand("execute_graphql", args, schemaFor("execute_graphql"));
      assert.ok(command !== undefined);

      const argv = runInShell(command, workspace);
      assert.ok(argv !== undefined);
      assert.equal(hasMarker(workspace, MARKER), false);
      assert.deepEqual(parseReplayArgv(argv, "execute_graphql"), args);
    });
  });

  it("should omit the replay when a string carries a NUL byte, which argv cannot hold", () => {
    const command = buildToolReplayCommand(
      "list_issues",
      { project_id: "123", search: "a\u0000b" },
      schemaFor("list_issues")
    );
    assert.equal(command, undefined);
  });

  it("should omit the replay when a string carries an unpaired surrogate", () => {
    const command = buildToolReplayCommand(
      "list_issues",
      { project_id: "123", search: "a\uD800b" },
      schemaFor("list_issues")
    );
    assert.equal(command, undefined);
  });
});

describe("When an argument name or tool name is not a plain identifier", () => {
  const UNSAFE_KEYS = [
    `$(touch ${MARKER}KEY)`,
    `a;touch ${MARKER}KEY`,
    "x`touch " + MARKER + "KEY`",
    "project id",
    "Project_ID",
    // Not tool arguments, but the CLI reads them as global flags from the same argv.
    "api_url",
    "http_proxy",
    "ca_cert_path",
    "output",
  ];

  for (const key of UNSAFE_KEYS) {
    it(`should omit the replay for argument name ${JSON.stringify(key)}`, () => {
      withStubWorkspace(workspace => {
        const command = buildToolReplayCommand(
          "list_issues",
          { project_id: "123", [key]: "1" },
          schemaFor("list_issues")
        );
        if (command !== undefined) {
          runInShell(command, workspace);
        }
        assert.equal(command, undefined, "an unsafe argument name must drop the replay");
        assert.equal(hasMarker(workspace, `${MARKER}KEY`), false);
      });
    });
  }

  it("should omit the replay for a tool name with shell syntax", () => {
    withStubWorkspace(workspace => {
      const command = buildToolReplayCommand(
        `list_issues$(touch ${MARKER})`,
        { project_id: "123" },
        schemaFor("list_issues")
      );
      if (command !== undefined) {
        runInShell(command, workspace);
      }
      assert.equal(command, undefined);
      assert.equal(hasMarker(workspace, MARKER), false);
    });
  });
});

describe("When replaying every registry tool", () => {
  it("should round-trip hostile values for each schema property through the CLI parser", () => {
    withStubWorkspace(workspace => {
      const failures: string[] = [];
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
        const properties = Object.entries(schema.properties ?? {}).filter(
          ([key]) => !SECRET_ARGUMENT_NAMES.has(key)
        );
        if (properties.length === 0) {
          continue;
        }
        const args: Record<string, unknown> = {};
        properties.forEach(([key, property], index) => {
          args[key] = sampleValue(property.type, index);
        });

        const command = buildToolReplayCommand(tool.name, args, tool.inputSchema);
        if (command === undefined) {
          failures.push(`${tool.name}: no replay for schema properties`);
          continue;
        }
        const argv = runInShell(command, workspace);
        if (argv === undefined) {
          failures.push(`${tool.name}: replay did not invoke the binary`);
          continue;
        }
        if (hasMarker(workspace, MARKER)) {
          failures.push(`${tool.name}: shell executed injected code`);
          break;
        }
        try {
          assert.deepEqual(parseReplayArgv(argv, tool.name), args);
        } catch (error) {
          failures.push(`${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      assert.deepEqual(failures, []);
    });
  });
});

function sampleValue(type: unknown, index: number): unknown {
  const types = (Array.isArray(type) ? type : [type]).filter(entry => entry !== "null");
  const hostile = HOSTILE_VALUES[index % HOSTILE_VALUES.length];
  // The CLI coerces a flag only when its schema type is a single scalar, so a
  // multi-type property round-trips as a string, the same as a free-text value.
  if (types.length === 1 && (types[0] === "number" || types[0] === "integer")) {
    return 7;
  }
  if (types.length === 1 && types[0] === "boolean") {
    return true;
  }
  if (types.includes("array")) {
    return [hostile];
  }
  if (types.includes("object")) {
    return { key: hostile };
  }
  return hostile;
}
