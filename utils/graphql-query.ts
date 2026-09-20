function stripGraphQLCommentsAndStrings(source: string): string {
  let result = "";
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === "#") {
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") {
        i++;
      }
      result += " ";
      continue;
    }

    if (source.slice(i, i + 3) === '"""') {
      i += 3;
      while (i < source.length && source.slice(i, i + 3) !== '"""') {
        if (source[i] === "\\" && source.slice(i, i + 4) === '\\"""') {
          i += 4;
          continue;
        }
        i++;
      }
      if (i < source.length) {
        i += 3;
      }
      result += " ";
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          i = Math.min(i + 2, source.length);
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      result += " ";
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

export function graphqlQueryContainsWriteOperation(query: string): boolean {
  const normalized = stripGraphQLCommentsAndStrings(query).trim();
  if (!normalized) {
    return false;
  }

  const operationTypePattern = /\s*(?:,\s*)?(query|mutation|subscription)\b/y;

  let depth = 0;
  let expectingOperationType = true;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (ch === "{") {
      depth++;
      expectingOperationType = false;
      continue;
    }

    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        expectingOperationType = true;
      }
      continue;
    }

    if (depth === 0 && (ch === ";" || ch === ",")) {
      expectingOperationType = true;
      continue;
    }

    if (depth === 0 && expectingOperationType) {
      operationTypePattern.lastIndex = i;
      const operationMatch = operationTypePattern.exec(normalized);
      if (operationMatch) {
        const operationType = operationMatch[1];
        expectingOperationType = false;
        if (operationType === "mutation" || operationType === "subscription") {
          return true;
        }
        i = operationTypePattern.lastIndex - 1;
      }
    }
  }

  return false;
}

// Verbs that mark a mutation as destructive for GITLAB_PERMISSION_MODE=modify.
// GitLab exposes many destructive mutations whose names do not contain "delete"
// (environmentStop, pipelineCancel, clusterAgentTokenRevoke, jobUnschedule, ...), so
// the ban covers teardown verbs as well as deletion verbs.
const DESTRUCTIVE_FIELD_PATTERN =
  /delete|destroy|remove|prune|purge|erase|revoke|cancel|stop|terminate|unprotect|disable|deactivate|drop|unschedule/i;

// GraphQL treats whitespace and commas as insignificant, including between an
// alias and its colon (`stop : field` and `stop,: field` are both aliases).
function skipInsignificantGraphQL(source: string, index: number): number {
  while (index < source.length && /[\s,]/.test(source[index])) {
    index++;
  }
  return index;
}

// Collects top-level selection field names of every mutation operation. Aliases are
// skipped: `stop: environmentStop(...)` must be judged by the field name, so a
// harmless label on a harmless field (`stop : issueSetSeverity(...)`) is not mistaken
// for a destructive mutation. Content inside parentheses (arguments) is skipped so
// argument names like removeSourceBranch do not count as delete fields. Returns null
// when a top-level fragment spread is present, since the spread could hide a delete
// field. Commas between operations are insignificant in GraphQL, so they are accepted
// as operation separators alongside `;` and `}`.
function extractTopLevelMutationFields(normalized: string): string[] | null {
  const fields: string[] = [];
  const mutationRegex = /(?:^|[;},]\s*)mutation\b[^({]*(?:\([^)]*\))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = mutationRegex.exec(normalized)) !== null) {
    let i = mutationRegex.lastIndex;
    let braceDepth = 1;
    let parenDepth = 0;
    let current = "";

    while (i < normalized.length && braceDepth > 0) {
      const ch = normalized[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
      else if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;

      if (braceDepth === 1 && parenDepth === 0) {
        if (normalized.startsWith("...", i)) {
          return null;
        }
        if (/[A-Za-z0-9_]/.test(ch)) {
          current += ch;
          i++;
          continue;
        }
      }
      if (current) {
        // Only the actual field name is tested. Skip insignificant tokens so a
        // teardown-verb alias does not look like a destructive mutation.
        if (normalized[skipInsignificantGraphQL(normalized, i)] !== ":") {
          fields.push(current);
        }
        current = "";
      }
      i++;
    }
    if (current) {
      fields.push(current);
    }
  }

  return fields;
}

// Kept as `...DeleteOperation` for callers, but the guard now covers every
// destructive mutation verb, not only delete-named ones.
export function graphqlQueryContainsDeleteOperation(query: string): boolean {
  const normalized = stripGraphQLCommentsAndStrings(query).trim();
  if (!normalized || !/(?:^|[;},]\s*)mutation\b/.test(normalized)) {
    return false;
  }

  const fields = extractTopLevelMutationFields(normalized);
  if (fields === null || fields.length === 0) {
    // Fragment spread at mutation top level, or a mutation whose selection set
    // could not be located (exotic syntax): be conservative and treat as delete
    return true;
  }
  return fields.some(field => DESTRUCTIVE_FIELD_PATTERN.test(field));
}

⚠ 1 unresolved conflict detected
- ours = HEAD
- theirs = bb0d4d9 (fix: stop matching aliases as destructive mutation field names)
NOTICE: Inspect a block by reading `conflict://<N>` (add `/ours` / `/theirs` / `/base` to render a single side). Resolve with `write({ path: "conflict://<N>", content })`, or bulk-resolve every registered conflict with `write({ path: "conflict://*", content })`. Writes replace ONLY the marker block (markers + all sides) — never repeat the lines before/after it; they stay in place.
`content` shorthand: a line that is exactly `@ours` / `@theirs` / `@base` / `@both` expands to that recorded section. `@both` is ours-then-theirs with no separator — only for additive conflicts where each side adds something different; NEVER for competing edits of the same lines (pick a side or write the combined text). Lines that are not a token pass through verbatim, so `"// keep both\n@ours\n@theirs"` literally writes the comment, then ours, then theirs.
Per-id bulk: `write({ path: "conflict://*", content: "1: @ours\n2: @theirs\n…" })` resolves each listed id with that side in ONE call — the cheapest way through many pick-one conflicts; unlisted ids stay registered.
Resolve each block faithfully: keep one side (`@ours`/`@theirs`), or combine them when both intents apply — never invent content beyond the recorded sides, and never stack both sides of competing edits. Resolve several conflicts in a single turn by issuing multiple `write` calls at once; ids stay valid as earlier blocks are resolved.

──── #1  L114-129 ────
<<< ours
// Collects top-level selection field names (and aliases) of every mutation operation.
// Content inside parentheses (arguments) is skipped so argument names like
// removeSourceBranch do not count as delete fields. Returns null when a top-level
// fragment spread is present, since the spread could hide a delete field.
// Commas between operations are insignificant in GraphQL, so they are accepted as
// operation separators alongside `;` and `}`.
>>> theirs
// Collects top-level selection field names of every mutation operation. Aliases are
// skipped: `stop: environmentStop(...)` must be judged by the field name, so a
// harmless label on a harmless field (`stop: issueSetSeverity(...)`) is not mistaken
// for a destructive mutation. Content inside parentheses (arguments) is skipped so
// argument names like removeSourceBranch do not count as delete fields. Returns null
// when a top-level fragment spread is present, since the spread could hide a delete
… (1 more line)