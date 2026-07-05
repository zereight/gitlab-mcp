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

  const writeOpPattern = /^\s*(?:,\s*)?(mutation|subscription)\b/;
  const operationTypePattern = /^\s*(?:,\s*)?(query|mutation|subscription)\b/;

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
      const rest = normalized.slice(i);
      if (operationTypePattern.test(rest)) {
        expectingOperationType = false;
        if (writeOpPattern.test(rest)) {
          return true;
        }
      }
    }
  }

  return false;
}
