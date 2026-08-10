import fs from "node:fs";
import path from "node:path";

/**
 * Reject absolute paths and directory-traversal sequences for user-supplied
 * local filesystem paths (e.g. local_path / file_path tool arguments).
 *
 * Returns the normalized relative path on success. This is a lexical check
 * only — callers that touch the filesystem must also use
 * {@link resolveSafeExistingPath}, {@link resolveSafeOutputDir}, or
 * {@link resolveSafeOutputFile}.
 */
export function assertSafeRelativePath(inputPath: string, label = "path"): string {
  const normalized = path.normalize(inputPath);
  if (
    path.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith(".." + path.sep) ||
    normalized.includes(path.sep + ".." + path.sep)
  ) {
    throw new Error(`Invalid ${label}: directory traversal is not allowed.`);
  }
  return normalized;
}

function isInsideBase(candidate: string, baseReal: string): boolean {
  return candidate === baseReal || candidate.startsWith(baseReal + path.sep);
}

/**
 * Walk each path component under baseReal and reject symbolic links so a
 * repository-controlled symlink cannot escape the trusted base directory.
 */
function assertNoSymlinkComponents(baseReal: string, relative: string, label: string): void {
  const parts = relative.split(path.sep).filter(part => part.length > 0 && part !== ".");
  let current = baseReal;
  for (const part of parts) {
    const next = path.join(current, part);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(next);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        // Remaining components do not exist yet (typical for mkdir output dirs).
        return;
      }
      throw err;
    }
    if (st.isSymbolicLink()) {
      throw new Error(`Invalid ${label}: symbolic links are not allowed.`);
    }
    current = next;
  }
}

/**
 * Resolve a user-supplied relative path to an existing file/dir that is
 * guaranteed to stay inside `baseDir` after symlink resolution.
 */
export function resolveSafeExistingPath(
  inputPath: string,
  label = "path",
  baseDir: string = process.cwd()
): string {
  const relative = assertSafeRelativePath(inputPath, label);
  const baseReal = fs.realpathSync(baseDir);
  assertNoSymlinkComponents(baseReal, relative, label);

  const absolute = path.resolve(baseDir, relative);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${relative}`);
  }

  const real = fs.realpathSync(absolute);
  if (!isInsideBase(real, baseReal)) {
    throw new Error(`Invalid ${label}: path escapes the allowed directory.`);
  }
  return real;
}

/**
 * Resolve a user-supplied relative output directory under `baseDir`, creating
 * it if needed. Rejects symlink components and verifies the final real path
 * remains inside the base.
 */
export function resolveSafeOutputDir(
  inputDir: string,
  label = "local_path",
  baseDir: string = process.cwd()
): string {
  const relative = assertSafeRelativePath(inputDir, label);
  const baseReal = fs.realpathSync(baseDir);
  assertNoSymlinkComponents(baseReal, relative, label);

  const absolute = path.resolve(baseDir, relative);
  fs.mkdirSync(absolute, { recursive: true });

  const real = fs.realpathSync(absolute);
  if (!isInsideBase(real, baseReal)) {
    throw new Error(`Invalid ${label}: path escapes the allowed directory.`);
  }
  return real;
}

/**
 * Build a write destination under a trusted directory. Rejects an existing
 * destination symlink so createWriteStream cannot follow it outside the base.
 *
 * When `inputDir` is omitted, the file is resolved under `baseDir` itself
 * (still rejecting symlink destinations).
 */
export function resolveSafeOutputFile(
  filename: string,
  inputDir?: string,
  label = "local_path",
  baseDir: string = process.cwd()
): string {
  if (
    !filename ||
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes(path.sep)
  ) {
    throw new Error(`Invalid ${label}: directory separators are not allowed in filename.`);
  }

  const dirReal = inputDir
    ? resolveSafeOutputDir(inputDir, label, baseDir)
    : fs.realpathSync(baseDir);
  const dest = path.join(dirReal, filename);

  try {
    const st = fs.lstatSync(dest);
    if (st.isSymbolicLink()) {
      throw new Error(`Invalid ${label}: symbolic links are not allowed.`);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw err;
    }
  }

  return dest;
}

/**
 * Estimate the number of merge commits that will be added based on the merge method.
 */
export function estimateMergeCommitCount(mergeMethod: string | null, sourceCommitCount: number): number | null {
  if (sourceCommitCount === 0) {
    return 0;
  }

  if (mergeMethod === "merge") {
    return 1;
  }

  if (mergeMethod === "ff" || mergeMethod === "rebase_merge") {
    return 0;
  }

  return null;
}

/**
 * Summarize webhook events by stripping heavy payload fields.
 */
export function summarizeWebhookEvents(events: Record<string, unknown>[]): Record<string, unknown>[] {
  return events.map(event => ({
    id: event.id,
    url: event.url,
    trigger: event.trigger,
    response_status: event.response_status,
    execution_duration: event.execution_duration,
  }));
}

/**
 * Filter MR diffs by excluding files matching regex patterns.
 *
 * @param diffs - Array of diff objects with new_path property
 * @param excludedFilePatterns - Array of regex patterns to exclude
 * @returns Filtered array of diffs
 */
export function filterDiffsByPatterns<T extends { new_path: string }>(
  diffs: T[],
  excludedFilePatterns: string[] | undefined
): T[] {
  if (!excludedFilePatterns?.length) return diffs;

  const regexPatterns = excludedFilePatterns
    .map(pattern => {
      try {
        return new RegExp(pattern);
      } catch (e) {
        console.warn(`Invalid regex pattern ignored: ${pattern}`);
        return null;
      }
    })
    .filter((regex): regex is RegExp => regex !== null);

  if (regexPatterns.length === 0) return diffs;

  const matchesAnyPattern = (path: string): boolean => {
    if (!path) return false;
    return regexPatterns.some(regex => regex.test(path));
  };

  return diffs.filter(diff => !matchesAnyPattern(diff.new_path));
}
