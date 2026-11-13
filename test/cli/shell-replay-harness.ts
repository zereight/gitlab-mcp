import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Test helper (not a test file). A replay command is run the way a terminal runs
// it: POSIX sh, with a harmless stub standing in for the binary on PATH. The stub
// records its argv NUL-separated, so values with spaces or newlines survive.

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
  if (!existsSync(workspace.argvFile)) {
    return undefined;
  }
  return readFileSync(workspace.argvFile, "utf8").split("\0").slice(0, -1);
}

/** True when the shell created `name` in the workspace, i.e. injected code ran. */
export function hasMarker(workspace: StubWorkspace, name: string): boolean {
  return existsSync(join(workspace.workDir, name));
}
