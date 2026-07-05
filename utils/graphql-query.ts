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

    if (source.slice(i, i + 3) === '"""') {
      i += 3;
      while (i < source.length && source.slice(i, i + 3) !== '"""') {
        i++;
      }
      if (i < source.length) {
        i += 3;
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

  return /(?:^|[};]\s*)(mutation|subscription)\b/.test(normalized);
}

const DELETE_FIELD_PATTERN = /delete|destroy|remove|prune|purge/i;

// Collects top-level selection field names (and aliases) of every mutation operation.
// Content inside parentheses (arguments) is skipped so argument names like
// removeSourceBranch do not count as delete fields. Returns null when a top-level
// fragment spread is present, since the spread could hide a delete field.
function extractTopLevelMutationFields(normalized: string): string[] | null {
  const fields: string[] = [];
  const mutationRegex = /(?:^|[};]\s*)mutation\b[^({]*(?:\([^)]*\))?\s*\{/g;
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
        fields.push(current);
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

export function graphqlQueryContainsDeleteOperation(query: string): boolean {
  const normalized = stripGraphQLCommentsAndStrings(query).trim();
  if (!normalized || !/(?:^|[};]\s*)mutation\b/.test(normalized)) {
    return false;
  }

  const fields = extractTopLevelMutationFields(normalized);
  if (fields === null || fields.length === 0) {
    // Fragment spread at mutation top level, or a mutation whose selection set
    // could not be located (exotic syntax): be conservative and treat as delete
    return true;
  }
  return fields.some(field => DELETE_FIELD_PATTERN.test(field));
}
