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
