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

  // Leading comma only at document start (F1); omit comma from [};,] to avoid
  // matching field names like `subscription` after `foo, subscription { ... }`.
  return /(?:^(?:,\s*)?|[};]\s*)(mutation|subscription)\b/.test(normalized);
}
