/**
 * Work item GraphQL queries select widget fragments that only exist on
 * GitLab Premium/Ultimate (WorkItemWidgetStatus, WorkItemWidgetWeight, ...) or
 * only on newer releases. GitLab validates the whole document, so on CE a
 * single unknown fragment condition fails the request with
 * "No such type WorkItemWidgetStatus, so it can't be a fragment condition" or
 * "Field 'blocked' doesn't exist on type 'WorkItemWidgetLinkedItems'".
 *
 * This module reads those validation errors and removes the named selections
 * from the query so the caller can retry. GitLab reports at most five
 * validation errors per response (`validate_max_errors 5`), so one retry may
 * surface more; callers loop until the query validates. See issue #959.
 */

export type UnsupportedWidgetSelections = {
  /** Types the instance does not define, used as `... on Type` conditions. */
  types: Set<string>;
  /** Fields the instance lacks, keyed by the fragment type that selects them. */
  fields: Map<string, Set<string>>;
};

// Only work item types are handled; other validation errors surface unchanged.
const MISSING_TYPE_PATTERN = /No such type (WorkItem\w*)\b/g;
const MISSING_FIELD_PATTERN = /Field '(\w+)' doesn't exist on type '(WorkItem\w*)'/g;

export function createUnsupportedWidgetSelections(): UnsupportedWidgetSelections {
  return { types: new Set(), fields: new Map() };
}

/**
 * Extract unsupported work item types/fields from a GraphQL error message.
 * Returns null when the message names none.
 */
export function parseUnsupportedWidgetSelections(
  message: string
): UnsupportedWidgetSelections | null {
  const found = createUnsupportedWidgetSelections();

  for (const match of message.matchAll(MISSING_TYPE_PATTERN)) {
    found.types.add(match[1]);
  }
  for (const match of message.matchAll(MISSING_FIELD_PATTERN)) {
    const [, field, type] = match;
    const fields = found.fields.get(type) ?? new Set<string>();
    fields.add(field);
    found.fields.set(type, fields);
  }

  return found.types.size > 0 || found.fields.size > 0 ? found : null;
}

/** Add everything in `source` to `target`. */
export function mergeUnsupportedWidgetSelections(
  target: UnsupportedWidgetSelections,
  source: UnsupportedWidgetSelections
): void {
  for (const type of source.types) {
    target.types.add(type);
  }
  for (const [type, fields] of source.fields) {
    const existing = target.fields.get(type) ?? new Set<string>();
    for (const field of fields) {
      existing.add(field);
    }
    target.fields.set(type, existing);
  }
}

/** Index just past the `}` that closes the `{` at `openIndex`. */
function skipBalanced(source: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i + 1;
  }
  return source.length;
}

function skipWhitespace(source: string, index: number): number {
  while (index < source.length && /[\s,]/.test(source[index])) index++;
  return index;
}

/**
 * Remove the named top-level fields (with their arguments and sub-selections)
 * from a fragment body. Nested selections and fragment spreads are left alone.
 */
function removeTopLevelFields(body: string, fields: Set<string>): string {
  let result = "";
  let i = 0;

  while (i < body.length) {
    const ch = body[i];

    if (body.startsWith("...", i)) {
      // Keep `... on Type { ... }` and `...Fragment` as they are.
      const spread = /\.\.\.(?:\s*on\s+\w+)?/y;
      spread.lastIndex = i;
      const match = spread.exec(body);
      const end = match ? spread.lastIndex : i + 3;
      result += body.slice(i, end);
      i = end;
      continue;
    }

    if (ch === "{" || ch === "(") {
      const end = skipBalanced(body, i, ch, ch === "{" ? "}" : ")");
      result += body.slice(i, end);
      i = end;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const name = /\w+/y;
      name.lastIndex = i;
      const token = name.exec(body)?.[0] ?? ch;
      let end = i + token.length;
      let fieldName = token;

      // `alias: field` — judge by the field name, remove alias and field together.
      const afterToken = skipWhitespace(body, end);
      if (body[afterToken] === ":") {
        const aliased = /\w+/y;
        aliased.lastIndex = skipWhitespace(body, afterToken + 1);
        const target = aliased.exec(body);
        if (target) {
          fieldName = target[0];
          end = aliased.lastIndex;
        }
      }

      if (!fields.has(fieldName)) {
        result += body.slice(i, end);
        i = end;
        continue;
      }

      // Drop arguments and sub-selection that belong to the removed field.
      let next = skipWhitespace(body, end);
      if (body[next] === "(") next = skipWhitespace(body, skipBalanced(body, next, "(", ")"));
      if (body[next] === "{") next = skipBalanced(body, next, "{", "}");
      i = next;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Return `query` without the fragments whose condition type is unsupported and
 * without the unsupported fields inside the remaining fragments. Returns the
 * input unchanged (same string) when nothing applies.
 */
export function pruneUnsupportedWidgetSelections(
  query: string,
  unsupported: UnsupportedWidgetSelections
): string {
  if (unsupported.types.size === 0 && unsupported.fields.size === 0) return query;

  const fragmentPattern = /\.\.\.\s*on\s+(\w+)\s*\{/g;
  const starts = Array.from(query.matchAll(fragmentPattern)).map(match => ({
    index: match.index,
    type: match[1],
    openOffset: match[0].length - 1,
  }));

  // Walk from the last fragment backwards so earlier indexes stay valid while the
  // text after them changes. Brace matching runs on the current text, so a nested
  // fragment that was already rewritten is measured correctly.
  let result = query;
  for (let n = starts.length - 1; n >= 0; n--) {
    const { index, type, openOffset } = starts[n];
    const openIndex = index + openOffset;
    const closeIndex = skipBalanced(result, openIndex, "{", "}");

    if (unsupported.types.has(type)) {
      result = result.slice(0, index) + result.slice(closeIndex);
      continue;
    }

    const fields = unsupported.fields.get(type);
    if (!fields || fields.size === 0) continue;

    const body = result.slice(openIndex + 1, closeIndex - 1);
    const pruned = removeTopLevelFields(body, fields);
    if (pruned === body) continue;

    // An empty selection set is invalid GraphQL, so drop the fragment instead.
    result =
      pruned.trim().length === 0
        ? result.slice(0, index) + result.slice(closeIndex)
        : result.slice(0, openIndex + 1) + pruned + result.slice(closeIndex - 1);
  }

  return result;
}
