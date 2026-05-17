/**
 * Patch helper for issue description updates.
 * Supports two patch formats:
 * - search_replace: exact text search/replace blocks
 * - unified_diff: standard unified diff via the `diff` library
 */

import { applyPatch, createTwoFilesPatch, parsePatch } from "diff";

export interface PatchResult {
  /** The patched description (or original for dry-run) */
  description: string;
  /** Number of replacements/patches applied */
  changes: number;
  /** Human-readable summary of what changed */
  summary: string;
  /** Unified diff preview of the change */
  preview: string;
}

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

/**
 * Parse a search/replace patch string into blocks.
 * Format:
 *   <<<<<<< SEARCH
 *   text to find
 *   =======
 *   text to replace with
 *   >>>>>>> REPLACE
 *
 * Supports multiple blocks.
 */
export function parseSearchReplaceBlocks(patch: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  // Match SEARCH...REPLACE blocks (greedy multiline)
  const regex = /<<<<<<< SEARCH[^\S\n]*\n([\s\S]*?)=======[^\S\n]*\n([\s\S]*?)>>>>>>> REPLACE[^\S\n]*/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(patch)) !== null) {
    let search = match[1];
    let replace = match[2];
    // Trim trailing newline from each side (the \n before ======= and before >>>>>>>)
    if (search.endsWith("\n")) search = search.slice(0, -1);
    if (replace.endsWith("\n")) replace = replace.slice(0, -1);
    blocks.push({ search, replace });
  }

  return blocks;
}

/**
 * Apply search/replace blocks to source text.
 *
 * @param source - Current text
 * @param blocks - Search/replace blocks
 * @param allowMultiple - If true, replace all occurrences; if false, fail on duplicate match
 * @returns PatchResult or throws on error
 */
export function applySearchReplace(
  source: string,
  blocks: SearchReplaceBlock[],
  allowMultiple: boolean = false
): PatchResult {
  let current = source;
  let totalChanges = 0;
  const changeLines: string[] = [];

  for (const block of blocks) {
    // Count occurrences
    const escapedSearch = escapeRegex(block.search);
    const regex = new RegExp(escapedSearch, "g");
    const occurrences = current.match(regex);

    if (!occurrences || occurrences.length === 0) {
      throw new Error(
        `Search text not found in issue description. Search block:\n---\n${block.search.slice(0, 200)}${block.search.length > 200 ? "..." : ""}\n---`
      );
    }

    if (occurrences.length > 1 && !allowMultiple) {
      throw new Error(
        `Search text matches ${occurrences.length} times (expected exactly 1). ` +
          "Use 'allow_multiple: true' to replace all occurrences.\n" +
          `Search block:\n---\n${block.search.slice(0, 200)}${block.search.length > 200 ? "..." : ""}\n---`
      );
    }

    // Apply replacement
    const replacement = block.replace;
    const replaced = current.replace(regex, () => replacement);

    // Detect no-op
    if (replaced === current) {
      throw new Error(
        `Replacement did not change the description (identical result). Search block:\n---\n${block.search.slice(0, 200)}${block.search.length > 200 ? "..." : ""}\n---`
      );
    }

    const count = occurrences.length;
    totalChanges += count;
    changeLines.push(`Replaced ${count} occurrence(s): "${truncate(block.search, 60)}" → "${truncate(block.replace, 60)}"`);
    current = replaced;
  }

  const summary = changeLines.join("\n");

  // Generate preview diff
  const preview = createTwoFilesPatch("current", "updated", source, current);

  return {
    description: current,
    changes: totalChanges,
    summary,
    preview,
  };
}

/**
 * Apply a unified diff patch to source text.
 * Delegates to the `diff` library's applyPatch.
 */
export function applyUnifiedDiff(source: string, patch: string): PatchResult {
// Validate the patch can be parsed first
  const parsed = parsePatch(patch);
  if (parsed.length === 0 || parsed.every((p) => p.hunks.length === 0)) {
    throw new Error(
      "Could not parse unified diff: no valid hunks found. " +
        "Expected format: '--- old\\n+++ new\\n@@ -line,count +line,count @@\\n context\\n-old\\n+new\\n'"
    );
  }

  const result = applyPatch(source, patch);
  if (result === false) {
    throw new Error(
      "Unified diff could not be applied to the current issue description. " +
        "The diff context may not match. Use 'dry_run: true' to debug."
    );
  }

  // Detect no-op: patch applied but nothing changed
  if (result === source) {
    throw new Error(
      "Unified diff applied but did not change the issue description. " +
        "The source text already matches the patched result."
    );
  }

  const changes = parsed.reduce(
    (sum, p) => sum + p.hunks.reduce((hSum, h) => hSum + h.lines.filter((l) => l.startsWith("-") || l.startsWith("+")).length, 0),
    0
  );

  // Generate preview of what actually changed
  const preview = createTwoFilesPatch("current", "updated", source, result);

  // Build summary from hunk headers
  const summaryLines: string[] = [];
  for (const p of parsed) {
    for (const hunk of p.hunks) {
      const added = hunk.lines.filter((l: string) => l.startsWith("+")).length;
      const removed = hunk.lines.filter((l: string) => l.startsWith("-")).length;
      summaryLines.push(`Hunk at line ${hunk.oldStart}: ${removed} removed, ${added} added`);
    }
  }

  return {
    description: result,
    changes,
    summary: summaryLines.join("\n"),
    preview,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}
