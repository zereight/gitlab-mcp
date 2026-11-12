// The guards below need the structure of a GraphQL document, not text patterns. A regex
// over the raw query can take a field alias or argument named `mutation` for an operation
// keyword, and it misses operation headers that the spec allows to contain commas,
// directives or comments. The document is therefore tokenized the way the GraphQL spec
// defines it, and the definitions are walked by a small parser. Anything the parser does
// not recognize throws, and the public checks treat that as a match (fail closed).

type GraphQLToken =
  | { kind: "name"; value: string }
  | { kind: "punct"; value: string }
  // A string or number. Its contents never change what a guard decides.
  | { kind: "literal" };

const PUNCTUATORS = new Set(["!", "$", "&", "(", ")", ":", "=", "@", "[", "]", "{", "|", "}"]);
const NAME_PATTERN = /[_A-Za-z][_0-9A-Za-z]*/y;
const NUMBER_PATTERN = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

// Index just past the regular string literal that starts at `start`.
function skipString(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') {
      return i + 1;
    }
    if (ch === "\n" || ch === "\r") {
      break;
    }
    i += ch === "\\" ? 2 : 1;
  }
  throw new Error("Unterminated GraphQL string");
}

// Index just past the block string that starts at `start`. Only `\"""` is an escape.
function skipBlockString(source: string, start: number): number {
  let i = start + 3;
  while (i < source.length) {
    if (source.startsWith('\\"""', i)) {
      i += 4;
    } else if (source.startsWith('"""', i)) {
      return i + 3;
    } else {
      i++;
    }
  }
  throw new Error("Unterminated GraphQL block string");
}

function tokenizeGraphQL(source: string): GraphQLToken[] {
  const tokens: GraphQLToken[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    // Ignored tokens: whitespace, line terminators, commas, the BOM, and comments.
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "," || ch === "﻿") {
      i++;
    } else if (ch === "#") {
      while (i < source.length && source[i] !== "\n" && source[i] !== "\r") {
        i++;
      }
    } else if (source.startsWith('"""', i)) {
      i = skipBlockString(source, i);
      tokens.push({ kind: "literal" });
    } else if (ch === '"') {
      i = skipString(source, i);
      tokens.push({ kind: "literal" });
    } else if (source.startsWith("...", i)) {
      tokens.push({ kind: "punct", value: "..." });
      i += 3;
    } else if (PUNCTUATORS.has(ch)) {
      tokens.push({ kind: "punct", value: ch });
      i++;
    } else if (ch === "-" || /[0-9]/.test(ch)) {
      NUMBER_PATTERN.lastIndex = i;
      const match = NUMBER_PATTERN.exec(source);
      if (!match) {
        throw new Error(`Invalid GraphQL number at ${i}`);
      }
      i += match[0].length;
      // A number cannot run into a name or a dot.
      if (i < source.length && /[_.A-Za-z0-9]/.test(source[i])) {
        throw new Error(`Invalid GraphQL number at ${i}`);
      }
      tokens.push({ kind: "literal" });
    } else {
      NAME_PATTERN.lastIndex = i;
      const match = NAME_PATTERN.exec(source);
      if (!match) {
        throw new Error(`Unexpected character in GraphQL document at ${i}`);
      }
      tokens.push({ kind: "name", value: match[0] });
      i += match[0].length;
    }
  }

  return tokens;
}

type OperationType = "query" | "mutation" | "subscription";

interface GraphQLOperation {
  type: OperationType;
  // Field names selected at the root of the operation, or null when the root selection
  // contains a fragment spread or inline fragment, whose fields cannot be listed here.
  rootFields: string[] | null;
}

const OPERATION_TYPES = new Set<string>(["query", "mutation", "subscription"]);
const CLOSING_BRACKET = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);

// Parses the executable definitions of a document. Throws on anything else: type-system
// definitions, stray punctuation, unbalanced brackets, or an empty selection set.
function parseGraphQLOperations(source: string): GraphQLOperation[] {
  const tokens = tokenizeGraphQL(source);
  const operations: GraphQLOperation[] = [];
  let pos = 0;

  function isPunct(value: string): boolean {
    const token: GraphQLToken | undefined = tokens[pos];
    return token !== undefined && token.kind === "punct" && token.value === value;
  }

  function isName(value?: string): boolean {
    const token: GraphQLToken | undefined = tokens[pos];
    return (
      token !== undefined && token.kind === "name" && (value === undefined || token.value === value)
    );
  }

  function expectPunct(value: string): void {
    if (!isPunct(value)) {
      throw new Error(`Expected "${value}" at token ${pos}`);
    }
    pos++;
  }

  function expectName(): string {
    const token: GraphQLToken | undefined = tokens[pos];
    if (token === undefined || token.kind !== "name") {
      throw new Error(`Expected a name at token ${pos}`);
    }
    pos++;
    return token.value;
  }

  // Skips a balanced "(...)", "[...]" or "{...}" that starts at the current token.
  function skipBalanced(): void {
    if (!isPunct("(") && !isPunct("[") && !isPunct("{")) {
      throw new Error(`Expected a bracket at token ${pos}`);
    }
    const closers: string[] = [];
    do {
      const token: GraphQLToken | undefined = tokens[pos];
      if (token === undefined) {
        throw new Error("Unclosed bracket in GraphQL document");
      }
      if (token.kind === "punct") {
        const closer = CLOSING_BRACKET.get(token.value);
        if (closer !== undefined) {
          closers.push(closer);
        } else if (token.value === ")" || token.value === "]" || token.value === "}") {
          if (closers.pop() !== token.value) {
            throw new Error("Mismatched bracket in GraphQL document");
          }
        }
      }
      pos++;
    } while (closers.length > 0);
  }

  function skipDirectives(): void {
    while (isPunct("@")) {
      pos++;
      expectName();
      if (isPunct("(")) {
        skipBalanced();
      }
    }
  }

  // Parses a selection set and returns its root field names. Nested selection sets are
  // parsed too, so a malformed body is rejected rather than skipped.
  function parseSelectionSet(): { fields: string[]; hasSpread: boolean } {
    expectPunct("{");
    const fields: string[] = [];
    let hasSpread = false;
    let selections = 0;

    while (!isPunct("}")) {
      selections++;
      if (isPunct("...")) {
        hasSpread = true;
        pos++;
        if (isName("on")) {
          pos++;
          expectName();
        } else if (isName()) {
          // Named fragment spread.
          pos++;
        }
        skipDirectives();
        if (isPunct("{")) {
          parseSelectionSet();
        }
      } else {
        let field = expectName();
        if (isPunct(":")) {
          // An alias: the field name after the colon is what GitLab executes.
          pos++;
          field = expectName();
        }
        if (isPunct("(")) {
          skipBalanced();
        }
        skipDirectives();
        if (isPunct("{")) {
          parseSelectionSet();
        }
        fields.push(field);
      }
    }

    if (selections === 0) {
      throw new Error("Empty selection set in GraphQL document");
    }
    pos++;
    return { fields, hasSpread };
  }

  function parseDefinition(): void {
    if (isName("fragment")) {
      pos++;
      if (isName("on")) {
        throw new Error("A fragment cannot be named on");
      }
      expectName();
      if (!isName("on")) {
        throw new Error("Expected a type condition on the fragment");
      }
      pos++;
      expectName();
      skipDirectives();
      parseSelectionSet();
      return;
    }

    let type: OperationType = "query";
    if (!isPunct("{")) {
      const keyword = expectName();
      if (!OPERATION_TYPES.has(keyword)) {
        throw new Error(`Unsupported GraphQL definition "${keyword}"`);
      }
      type = keyword as OperationType;
      if (isName()) {
        // Operation name.
        pos++;
      }
      if (isPunct("(")) {
        skipBalanced();
      }
      skipDirectives();
    }

    const selection = parseSelectionSet();
    operations.push({
      type,
      rootFields: selection.hasSpread ? null : selection.fields,
    });
  }

  while (pos < tokens.length) {
    parseDefinition();
  }
  return operations;
}

// Returns true when the document contains a mutation or subscription. A document that
// cannot be parsed is treated as a write.
export function graphqlQueryContainsWriteOperation(query: string): boolean {
  let operations: GraphQLOperation[];
  try {
    operations = parseGraphQLOperations(query);
  } catch {
    return true;
  }
  return operations.some(operation => operation.type !== "query");
}

// Verbs that mark a mutation as destructive for GITLAB_PERMISSION_MODE=modify.
// GitLab exposes many destructive mutations whose names do not contain "delete"
// (environmentStop, pipelineCancel, clusterAgentTokenRevoke, jobUnschedule, ...), so
// the ban covers teardown verbs as well as deletion verbs.
const DESTRUCTIVE_FIELD_PATTERN =
  /delete|destroy|remove|prune|purge|erase|revoke|cancel|stop|terminate|unprotect|disable|deactivate|drop|unschedule/i;

// Kept as `...DeleteOperation` for callers, but the guard now covers every
// destructive mutation verb, not only delete-named ones. Only the field name is tested,
// so an alias such as `stop: issueSetSeverity(...)` does not count as a destructive field.
export function graphqlQueryContainsDeleteOperation(query: string): boolean {
  let operations: GraphQLOperation[];
  try {
    operations = parseGraphQLOperations(query);
  } catch {
    // The document could hide a mutation, so it is blocked.
    return true;
  }
  return operations.some(operation => {
    if (operation.type !== "mutation") {
      return false;
    }
    // A root fragment spread could hide any field, so it is blocked too.
    return (
      operation.rootFields === null ||
      operation.rootFields.some(field => DESTRUCTIVE_FIELD_PATTERN.test(field))
    );
  });
}
