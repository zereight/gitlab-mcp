import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

// Test helper (not a test file). A replay command is run the way a terminal runs
// it: POSIX sh, and PowerShell when it is installed, with a harmless stub standing
// in for the binary on PATH. The stub records its argv NUL-separated, so values
// with spaces or newlines survive.

export interface StubWorkspace {
  readonly workDir: string;
  readonly binDir: string;
  readonly argvFile: string;
  cleanup(): void;
}

const STUB_SCRIPT = ["#!/bin/sh", `printf '%s\\0' "$@" > "$STUB_OUT"`, ""].join("\n");

export function createStubWorkspace(): StubWorkspace {
  const root = mkdtempSync(join(tmpdir(), "replay-shell-"));
  const workDir = join(root, "work");
  const binDir = join(root, "bin");
  mkdirSync(workDir);
  mkdirSync(binDir);
  const stubPath = join(binDir, "zereight-mcp-gitlab");
  writeFileSync(stubPath, STUB_SCRIPT);
  chmodSync(stubPath, 0o755);
  return {
    workDir,
    binDir,
    argvFile: join(root, "argv.bin"),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function withStubWorkspace<T>(run: (workspace: StubWorkspace) => T): T {
  const workspace = createStubWorkspace();
  try {
    return run(workspace);
  } finally {
    workspace.cleanup();
  }
}

/** Runs `command` with sh in the workspace; returns the argv the stub received, or undefined if it never ran. */
export function runInShell(command: string, workspace: StubWorkspace): string[] | undefined {
  rmSync(workspace.argvFile, { force: true });
  spawnSync("/bin/sh", ["-c", command], {
    cwd: workspace.workDir,
    env: { PATH: `${workspace.binDir}:${process.env.PATH ?? ""}`, STUB_OUT: workspace.argvFile },
    encoding: "utf8",
    timeout: 15_000,
  });
  return readStubArgv(workspace.argvFile);
}

/** True when the shell created `name` in the workspace, i.e. injected code ran. */
export function hasMarker(workspace: StubWorkspace, name: string): boolean {
  return existsSync(join(workspace.workDir, name));
}

// A `cli` line is built from two kinds of token: a bare word, which sh, cmd.exe
// and PowerShell all pass unchanged, and a double-quoted run (alone, or after a
// `--flag=` prefix) that none of them expands. A line made of nothing else gives
// the same argv in all three, so this check stands in for the shells this host
// cannot run (cmd.exe, Windows PowerShell 5.1).
const PORTABLE_LINE = /^[A-Za-z0-9 ._:/=+,"-]+$/;
const BARE = "[A-Za-z0-9._:/=+-]+";
const QUOTED = '"[A-Za-z0-9 ._:/=+,-]+"';
const PORTABLE_TOKEN = new RegExp(`^(?:${BARE}|${QUOTED}|--[a-z0-9-]+=${QUOTED})$`);

/** Returns the argv (binary name first) every supported shell reads from `command`; fails if any token is not portable. */
export function parsePortableCommand(command: string): string[] {
  assert.match(command, PORTABLE_LINE, "the cli line uses a character outside the portable set");
  assert.equal(
    (command.match(/"/g) ?? []).length % 2,
    0,
    "the cli line has unbalanced double quotes"
  );
  const tokens: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of command) {
    if (char === '"') {
      quoted = !quoted;
    }
    if (char === " " && !quoted) {
      tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  tokens.push(current);
  return tokens.map(token => {
    assert.match(token, PORTABLE_TOKEN, `not a portable token: ${JSON.stringify(token)}`);
    // PowerShell reads a word that starts with exactly one dash as a parameter
    // name and may split it, for example `-Dfoo.bar` into `-Dfoo` and `.bar`.
    assert.equal(/^-(?!-)/.test(token), false, `token starts with a single dash: ${token}`);
    return token.replace(/"/g, "");
  });
}

/** PowerShell (`pwsh`) from PWSH_PATH or PATH; undefined when it is not installed. */
export const PWSH_PATH: string | undefined = findPwsh();

/** Reason to pass as `{ skip }` for PowerShell-only tests; false when pwsh is available. */
export const SKIP_WITHOUT_PWSH: string | false =
  PWSH_PATH === undefined
    ? "pwsh is not installed (set PWSH_PATH to run PowerShell checks)"
    : false;

function findPwsh(): string | undefined {
  const configured = process.env.PWSH_PATH;
  if (configured !== undefined && configured !== "") {
    return configured;
  }
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const name of ["pwsh", "pwsh.exe"]) {
      const candidate = join(dir, name);
      if (dir !== "" && existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * Runs each command with `pwsh -NoProfile -NonInteractive -Command` in one
 * PowerShell process, and returns the argv the stub received for each (undefined
 * for a command that never invoked it). Fails when PowerShell is not installed.
 */
export function runInPwsh(
  commands: readonly string[],
  workspace: StubWorkspace
): (string[] | undefined)[] {
  assert.ok(PWSH_PATH !== undefined, "pwsh is not installed");
  const outFile = (index: number): string => `${workspace.argvFile}.${index}`;
  commands.forEach((_, index) => rmSync(outFile(index), { force: true }));
  // Each command writes to its own file; `$env:STUB_BASE` keeps the path out of the script.
  const script = commands
    .map((command, index) => `$env:STUB_OUT = $env:STUB_BASE + '.${index}'\n${command}`)
    .join("\n");
  const result = spawnSync(PWSH_PATH, ["-NoProfile", "-NonInteractive", "-Command", script], {
    cwd: workspace.workDir,
    env: {
      ...process.env,
      PATH: `${workspace.binDir}${delimiter}${process.env.PATH ?? ""}`,
      STUB_BASE: workspace.argvFile,
      POWERSHELL_TELEMETRY_OPTOUT: "1",
      POWERSHELL_UPDATECHECK: "Off",
    },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return commands.map((_, index) => readStubArgv(outFile(index)));
}

/**
 * Runs a `cli` line in every shell this host has (sh, and pwsh when installed),
 * checks each gives the argv `parsePortableCommand` reads from it and that the
 * line ran nothing but the binary, and returns that argv without the binary name.
 */
export function runInEveryShell(command: string, workspace: StubWorkspace): string[] {
  const expected = parsePortableCommand(command).slice(1);
  assert.deepEqual(runInShell(command, workspace), expected, `sh read ${command} differently`);
  if (PWSH_PATH !== undefined) {
    const [argv] = runInPwsh([command], workspace);
    assert.deepEqual(argv, expected, `pwsh read ${command} differently`);
  }
  assertOnlyBinaryRan(workspace);
  return expected;
}

/** Fails when a shell left any file in the workspace, i.e. it ran more than the stub binary. */
export function assertOnlyBinaryRan(workspace: StubWorkspace): void {
  assert.deepEqual(readdirSync(workspace.workDir), [], "the line ran more than the binary");
}

function readStubArgv(file: string): string[] | undefined {
  if (!existsSync(file)) {
    return undefined;
  }
  return readFileSync(file, "utf8").split("\0").slice(0, -1);
}
