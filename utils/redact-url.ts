import { isIP } from "node:net";

const SENSITIVE_QUERY_NAMES: ReadonlySet<string> = new Set([
  "access_token",
  "private_token",
  "job_token",
  "password",
  "token",
]);

/**
 * Removes userinfo from a GitLab API URL before it is returned to the client.
 * A password with an unencoded slash is not a valid WHATWG URL, or parses as a
 * host and port ("https://u:12/ab@host" has host "u"), so those forms use the
 * same text redaction as transport error messages.
 */
export function redactGitLabUrlCredentials(url: string): string {
  try {
    const parsed = new URL(url);
    const hadUserinfo = parsed.username.length > 0 || parsed.password.length > 0;
    if (hadUserinfo) {
      parsed.username = "";
      parsed.password = "";
    }
    const serialized = hadUserinfo ? parsed.toString() : redactUrlUserinfoInText(url);
    return redactSensitiveQuery(serialized);
  } catch {
    return redactSensitiveQuery(redactUrlUserinfoInText(url));
  }
}

/**
 * Log text can contain several URLs. A parseable URL keeps `[REDACTED]@`
 * where userinfo was. redactGitLabUrlCredentials strips that userinfo instead,
 * because the value is returned to the client as a URL.
 */
export function redactUrlSecretsInText(text: string): string {
  return redactSensitiveQuery(redactUrlUserinfoInText(redactParseableUrlUserinfo(text)));
}

/**
 * Redacts an error in place: `message`, `stack`, and every `cause` below it.
 * undici and `new URL()` put the URL they rejected into the message, so a
 * credentialed URL would otherwise reach the MCP client and the log verbatim.
 * The `input` and `base` of an ERR_INVALID_URL are replaced, not redacted:
 * text that did not parse has no host to keep, and it can be the start of a
 * password cut off at a comma ("http://alice:p/api/v4"), with no "@" for the
 * text redaction to find. The same text is replaced wherever another error
 * of the chain quotes it ("Failed to parse URL from ...", or a wrapper that
 * copies that message): every such text in the error passed in, and in an
 * error below it the first MAX_SHARED_INVALID_URLS and those of its own cause.
 * A thrown string is returned redacted; other values are returned unchanged.
 */
export function redactUrlSecretsInError(error: unknown): unknown {
  if (typeof error === "string") {
    return redactUrlSecretsInText(error);
  }
  const chain = readErrorChain(error);
  for (const item of chain.errors) {
    redactChainedError(item, chain);
  }
  return error;
}

/**
 * The redacted message of a caught error, for a tool result that reports the
 * failure in its data (`{ "error": "GraphQL request failed: ..." }`) instead of
 * as an isError result.
 */
export function redactUrlSecretsInErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return redactUrlSecretsInText(String(error));
  }
  return redactUrlSecretsInText(withoutInvalidUrls(error.message, error, readErrorChain(error)));
}

const REDACTED = "[REDACTED]";
// Own enumerable fields of Node's ERR_INVALID_URL, which pino's error serializer copies.
const INVALID_URL_FIELDS = ["input", "base"] as const;
// The texts looked for in the message and stack of each error below the one the
// chain was read from. More would make an AggregateError of many parse failures
// quadratic; past this, an error still has the texts of its own cause removed.
const MAX_SHARED_INVALID_URLS = 32;

// The input and base of each ERR_INVALID_URL as first read. A wrapper that quoted
// them can be redacted after the ERR_INVALID_URL already was.
const invalidUrlTexts = new WeakMap<Error, readonly string[]>();

interface ErrorChain {
  readonly errors: readonly Error[];
  // Every input and base in the chain, for the error the chain was read from: an
  // AggregateError's own message can quote the message of each of its errors.
  readonly texts: readonly string[];
  readonly heads: TextHeads | undefined;
  // Built from `texts` the first time a message or stack may quote one of them.
  matcher: TextMatcher | undefined;
  // The first MAX_SHARED_INVALID_URLS of them, longest first, for each error below it.
  readonly shared: readonly string[];
}

function isInvalidUrlError(value: unknown): value is Error & Record<string, unknown> {
  return value instanceof Error && (value as { code?: unknown }).code === "ERR_INVALID_URL";
}

function readInvalidUrlTexts(error: unknown): readonly string[] {
  if (!isInvalidUrlError(error)) {
    return [];
  }
  const known = invalidUrlTexts.get(error);
  if (known !== undefined) {
    return known;
  }
  const texts: string[] = [];
  for (const field of INVALID_URL_FIELDS) {
    const value = error[field];
    if (typeof value === "string" && value.length > 0 && value !== REDACTED) {
      texts.push(value);
    }
  }
  invalidUrlTexts.set(error, texts);
  return texts;
}

// Every error reachable through `cause` and AggregateError `errors`, each once.
function readErrorChain(root: unknown): ErrorChain {
  const errors: Error[] = [];
  const all = new Set<string>();
  const seen = new Set<Error>();
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (!(value instanceof Error) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    errors.push(value);
    for (const text of readInvalidUrlTexts(value)) {
      all.add(text);
    }
    pending.push(value.cause);
    if (value instanceof AggregateError && Array.isArray(value.errors)) {
      for (const inner of value.errors) {
        pending.push(inner);
      }
    }
  }
  const texts = [...all];
  return {
    errors,
    texts,
    heads: texts.length > 0 ? buildTextHeads(texts) : undefined,
    matcher: undefined,
    shared: texts.slice(0, MAX_SHARED_INVALID_URLS).sort(byLengthDescending),
  };
}

function redactChainedError(error: Error, chain: ErrorChain): void {
  // Before the text redaction can change the quoted text.
  hideInvalidUrls(error, "message", chain);
  hideInvalidUrls(error, "stack", chain);
  redactErrorField(error, "message");
  redactErrorField(error, "stack");
  if (isInvalidUrlError(error)) {
    for (const field of INVALID_URL_FIELDS) {
      const value = error[field];
      if (typeof value === "string" && value.length > 0) {
        setErrorField(error, field, REDACTED);
      }
    }
  }
  if (typeof error.cause === "string") {
    redactErrorField(error, "cause");
  }
}

function hideInvalidUrls(error: Error, field: "message" | "stack", chain: ErrorChain): void {
  const value: unknown = error[field];
  if (typeof value !== "string") {
    return;
  }
  const hidden = withoutInvalidUrls(value, error, chain);
  if (hidden !== value) {
    setErrorField(error, field, hidden);
  }
}

function withoutInvalidUrls(text: string, error: Error, chain: ErrorChain): string {
  if (error === chain.errors[0]) {
    if (chain.heads === undefined || !mayQuoteText(text, chain.heads)) {
      return text;
    }
    chain.matcher ??= buildTextMatcher(chain.texts);
    return hideMatchedTexts(text, chain.matcher);
  }
  let hidden = text;
  for (const invalidUrl of withOwnTexts(chain.shared, readInvalidUrlTexts(error.cause))) {
    if (hidden.includes(invalidUrl)) {
      hidden = hidden.split(invalidUrl).join(REDACTED);
    }
  }
  return hidden;
}

// Longest first, so a base that contains the input leaves no tail behind.
function byLengthDescending(a: string, b: string): number {
  return b.length - a.length;
}

// The shared texts, already longest first, with those of an error's own cause
// merged in. Of two the same length the shared one comes first, as in a stable
// sort of both lists, without sorting the shared ones again for each error.
function withOwnTexts(shared: readonly string[], own: readonly string[]): readonly string[] {
  if (own.length === 0) {
    return shared;
  }
  const rest = [...own].sort(byLengthDescending);
  const texts: string[] = [];
  let next = 0;
  for (const text of shared) {
    while (next < rest.length && rest[next].length > text.length) {
      texts.push(rest[next]);
      next += 1;
    }
    texts.push(text);
  }
  return texts.concat(rest.slice(next));
}

/**
 * The hash of the first `width` code units of each text, `width` being the same
 * for every text. A text can only occur where a window of that many code units
 * has one of these hashes, so a message with no such window quotes none of the
 * texts and needs no matcher: an AggregateError's own message seldom does.
 */
interface TextHeads {
  readonly width: number;
  readonly hashes: ReadonlySet<number>;
}

// Long enough that few windows look like the start of a URL, short enough to hash fast.
const MAX_HEAD_WIDTH = 16;
const HASH_BASE = 0x01000193;
// Keeps each hash a small integer.
const HASH_MASK = 0x3fffffff;

function buildTextHeads(texts: readonly string[]): TextHeads {
  let width = MAX_HEAD_WIDTH;
  for (const text of texts) {
    width = Math.min(width, text.length);
  }
  const hashes = new Set<number>();
  for (const text of texts) {
    let hash = 0;
    for (let index = 0; index < width; index += 1) {
      hash = (Math.imul(hash, HASH_BASE) + text.charCodeAt(index)) | 0;
    }
    hashes.add(hash & HASH_MASK);
  }
  return { width, hashes };
}

// A rolling hash over each window of the text, in one pass.
function mayQuoteText(text: string, heads: TextHeads): boolean {
  const { width, hashes } = heads;
  // HASH_BASE ** (width - 1), to take out the code unit that leaves the window.
  let top = 1;
  for (let index = 1; index < width; index += 1) {
    top = Math.imul(top, HASH_BASE);
  }
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (index >= width) {
      hash = (hash - Math.imul(text.charCodeAt(index - width), top)) | 0;
    }
    hash = (Math.imul(hash, HASH_BASE) + text.charCodeAt(index)) | 0;
    if (index + 1 >= width && hashes.has(hash & HASH_MASK)) {
      return true;
    }
  }
  return false;
}

/**
 * Finds a list of texts in one pass over a message (Aho-Corasick), so the cost
 * is the message length plus the total length of the texts, not their product.
 * Nodes are the prefixes of the texts; node 0 is the empty one.
 */
interface TextMatcher {
  // The edges in an open-addressing table. A slot holds the key of an edge,
  // node * CODE_UNITS + code unit + 1, or 0 when empty; and the node it leads to.
  // A Map is slower here: most of these keys are too large for a small integer,
  // so each one would be a heap number.
  readonly keys: Float64Array;
  readonly targets: Int32Array;
  // The node of the longest proper suffix of a node that is also a node.
  readonly fail: Int32Array;
  // The length of the longest text that ends a node, or 0.
  readonly longest: Int32Array;
}

const CODE_UNITS = 0x10000;

// The slot of the edge from a node on a code unit, or the empty slot it would take.
function edgeSlot(keys: Float64Array, node: number, code: number): number {
  const key = node * CODE_UNITS + code + 1;
  const mask = keys.length - 1;
  let hash = Math.imul(node, 0x9e3779b1) ^ code;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  let slot = (hash ^ (hash >>> 13)) & mask;
  while (keys[slot] !== 0 && keys[slot] !== key) {
    slot = (slot + 1) & mask;
  }
  return slot;
}

function buildTextMatcher(texts: readonly string[]): TextMatcher {
  let size = 1;
  for (const text of texts) {
    size += text.length;
  }
  // A power of two, at least twice the number of edges.
  let slots = 2;
  while (slots < 2 * size) {
    slots *= 2;
  }
  const keys = new Float64Array(slots);
  const targets = new Int32Array(slots);
  const longest = new Int32Array(size);
  // The children of a node as a list: its first child, then each child's sibling.
  // 0 ends a list, because node 0 is no node's child.
  const firstChild = new Int32Array(size);
  const sibling = new Int32Array(size);
  const unit = new Int32Array(size);
  let nodes = 1;
  for (const text of texts) {
    let node = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      const slot = edgeSlot(keys, node, code);
      if (keys[slot] === 0) {
        keys[slot] = node * CODE_UNITS + code + 1;
        targets[slot] = nodes;
        unit[nodes] = code;
        sibling[nodes] = firstChild[node];
        firstChild[node] = nodes;
        nodes += 1;
      }
      node = targets[slot];
    }
    longest[node] = text.length;
  }
  // Breadth first: a fail link points to a shorter node, whose own link and
  // longest text are then already known.
  const matcher = { keys, targets, fail: new Int32Array(size), longest };
  const queue = new Int32Array(nodes);
  let queued = 0;
  for (let child = firstChild[0]; child !== 0; child = sibling[child]) {
    queue[queued] = child;
    queued += 1;
  }
  for (let head = 0; head < queued; head += 1) {
    const node = queue[head];
    if (longest[node] === 0) {
      longest[node] = longest[matcher.fail[node]];
    }
    for (let child = firstChild[node]; child !== 0; child = sibling[child]) {
      matcher.fail[child] = nextNode(matcher, matcher.fail[node], unit[child]);
      queue[queued] = child;
      queued += 1;
    }
  }
  return matcher;
}

function nextNode(matcher: TextMatcher, node: number, code: number): number {
  for (let from = node; ; from = matcher.fail[from]) {
    const slot = edgeSlot(matcher.keys, from, code);
    if (matcher.keys[slot] !== 0) {
      return matcher.targets[slot];
    }
    if (from === 0) {
      return 0;
    }
  }
}

// Each part of the text covered by a text of the matcher becomes one [REDACTED].
// Overlapping matches are merged, so a shorter text inside a longer one leaves
// nothing behind; matches that only touch stay apart, as split and join leave them.
function hideMatchedTexts(text: string, matcher: TextMatcher): string {
  const starts: number[] = [];
  const ends: number[] = [];
  let node = 0;
  for (let index = 0; index < text.length; index += 1) {
    node = nextNode(matcher, node, text.charCodeAt(index));
    const length = matcher.longest[node];
    if (length === 0) {
      continue;
    }
    let start = index + 1 - length;
    while (ends.length > 0 && ends[ends.length - 1] > start) {
      ends.pop();
      start = Math.min(start, starts.pop() ?? start);
    }
    starts.push(start);
    ends.push(index + 1);
  }
  if (starts.length === 0) {
    return text;
  }
  const parts: string[] = [];
  let from = 0;
  for (let range = 0; range < starts.length; range += 1) {
    parts.push(text.slice(from, starts[range]), REDACTED);
    from = ends[range];
  }
  parts.push(text.slice(from));
  return parts.join("");
}

function redactErrorField(error: Error, field: "message" | "stack" | "cause"): void {
  const value: unknown = error[field];
  if (typeof value !== "string") {
    return;
  }
  const redacted = redactUrlSecretsInText(value);
  if (redacted !== value) {
    setErrorField(error, field, redacted);
  }
}

function setErrorField(error: Error, field: string, value: string): void {
  try {
    (error as unknown as Record<string, unknown>)[field] = value;
  } catch {
    // A frozen error keeps its text; the logger still redacts its own copy.
  }
}

/**
 * Redacts one serialized pino line. Each JSON string is redacted after
 * JSON.parse, so a URL next to a quote cannot pull the rest of the line into
 * the userinfo match. A line that is not JSON is redacted as text.
 */
export function redactUrlSecretsInLogLine(line: string): string {
  if (!line.includes("@") && !line.includes("=")) {
    return line;
  }
  const newline = line.endsWith("\n") ? "\n" : "";
  const body = newline ? line.slice(0, -1) : line;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return redactUrlSecretsInText(line);
  }
  let changed = false;
  const redacted = mapJsonStrings(parsed, value => {
    const next = redactUrlSecretsInText(value);
    changed ||= next !== value;
    return next;
  });
  return changed ? `${JSON.stringify(redacted)}${newline}` : line;
}

function mapJsonStrings(value: unknown, map: (value: string) => string): unknown {
  if (typeof value === "string") {
    return map(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => mapJsonStrings(item, map));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapJsonStrings(item, map)])
    );
  }
  return value;
}

/**
 * Drops userinfo from a configured GitLab API URL. fetch() refuses a URL with
 * credentials, and GitLab API authentication goes in request headers, so the
 * userinfo is removed before any request is built. A value that does not parse
 * is returned unchanged for the config validation to report.
 */
export function stripUrlUserinfo(url: string): {
  readonly url: string;
  readonly hadUserinfo: boolean;
} {
  const trimmed = url.trim();
  const parsed = tryParseUrl(trimmed);
  if (parsed === null || (parsed.username.length === 0 && parsed.password.length === 0)) {
    return { url, hadUserinfo: false };
  }
  parsed.username = "";
  parsed.password = "";
  const serialized = parsed.toString();
  // "https://user:pass@host" serializes as "https://host/"; keep the input's form.
  const addedRootSlash =
    parsed.pathname === "/" &&
    parsed.search.length === 0 &&
    parsed.hash.length === 0 &&
    !trimmed.endsWith("/");
  return { url: addedRootSlash ? serialized.slice(0, -1) : serialized, hadUserinfo: true };
}

function redactSensitiveQuery(url: string): string {
  // The name cannot hold a separator, so a run of "?" is not rescanned from each one.
  return url.replace(
    /([?&#])([^=&\s#?]+)=[^&\s#]+/g,
    (match, separator: string, rawName: string) => {
      if (!isSensitiveQueryName(rawName)) {
        return match;
      }
      return `${separator}${rawName}=[REDACTED]`;
    }
  );
}

function isSensitiveQueryName(rawName: string): boolean {
  return SENSITIVE_QUERY_NAMES.has(decodeQueryName(rawName).toLowerCase());
}

function decodeQueryName(rawName: string): string {
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

// Every scan below runs in time linear in the text: log lines can carry
// client-chosen strings such as an unknown tool name.
function redactUrlUserinfoInText(message: string): string {
  // A token can hold a comma-separated GITLAB_API_URL list; each entry has its own userinfo.
  const withoutCompactUserinfo = replaceUrlTokens(message, urlToken =>
    splitCommaSeparatedUrls(urlToken).map(redactCompactUserinfo).join(",")
  );
  return redactSpacedUserinfo(withoutCompactUserinfo);
}

const WORD_CHAR_PATTERN = /\w/;
const WHITESPACE_PATTERN = /\s/;
const NEXT_WHITESPACE_PATTERN = /\s/g;

// The tokens /\b[a-z][a-z0-9+.-]*:\S+/gi matches: a scheme, then the text up
// to the next whitespace.
function replaceUrlTokens(text: string, replace: (urlToken: string) => string): string {
  const parts: string[] = [];
  let copied = 0;
  let colon = text.indexOf(":");
  while (colon !== -1) {
    const followedByText = colon + 1 < text.length && !WHITESPACE_PATTERN.test(text[colon + 1]);
    const start = followedByText ? findSchemeStart(text, colon) : -1;
    if (start === -1) {
      colon = text.indexOf(":", colon + 1);
      continue;
    }
    const end = indexOfPattern(text, NEXT_WHITESPACE_PATTERN, colon + 1);
    parts.push(text.slice(copied, start), replace(text.slice(start, end)));
    copied = end;
    colon = text.indexOf(":", end);
  }
  parts.push(text.slice(copied));
  return parts.join("");
}

// "scheme://user:pa ss@host": a password with whitespace splits the token above.
function redactSpacedUserinfo(text: string): string {
  const parts: string[] = [];
  let copied = 0;
  let colon = text.indexOf("://");
  while (colon !== -1) {
    const start = findSchemeStart(text, colon);
    const authorityStart = colon + 3;
    const atIndex = start === -1 ? -1 : findSpacedUserinfoEnd(text, authorityStart);
    if (atIndex === -1) {
      colon = text.indexOf("://", colon + 1);
      continue;
    }
    const end = atIndex + 1;
    if (!looksLikeHostPort(text.slice(authorityStart, atIndex), text.slice(end))) {
      parts.push(text.slice(copied, start), `${text.slice(start, authorityStart)}[REDACTED]@`);
      copied = end;
    }
    colon = text.indexOf("://", end);
  }
  parts.push(text.slice(copied));
  return parts.join("");
}

const SPACED_USERINFO_STOP_PATTERN = /[\s/:@.]/;

// Index of the "@" that ends /[^\s/:@.]+(?::[^\s/:@.]+)+(?:\s+[^\s/:@.]+)+@/ at
// `start`, or -1. Its parts cannot overlap, so one pass decides the match, and
// the scan stops at the next "://".
function findSpacedUserinfoEnd(text: string, start: number): number {
  let index = skipUserinfoRun(text, start);
  if (index === start || text[index] !== ":") {
    return -1;
  }
  while (text[index] === ":") {
    const runEnd = skipUserinfoRun(text, index + 1);
    if (runEnd === index + 1) {
      return -1;
    }
    index = runEnd;
  }
  let spacedRuns = 0;
  while (index < text.length && WHITESPACE_PATTERN.test(text[index])) {
    let runStart = index + 1;
    while (runStart < text.length && WHITESPACE_PATTERN.test(text[runStart])) {
      runStart += 1;
    }
    const runEnd = skipUserinfoRun(text, runStart);
    if (runEnd === runStart) {
      return -1;
    }
    index = runEnd;
    spacedRuns += 1;
  }
  return spacedRuns > 0 && text[index] === "@" ? index : -1;
}

function skipUserinfoRun(text: string, from: number): number {
  let index = from;
  while (index < text.length && !SPACED_USERINFO_STOP_PATTERN.test(text[index])) {
    index += 1;
  }
  return index;
}

// Start of the scheme that ends at `colon`, where /\b[a-z][a-z0-9+.-]*:/i
// would match it, or -1. Walking back from the ":" reads a run like "a.a.a.a"
// once; the regex would rescan it from every letter.
function findSchemeStart(text: string, colon: number): number {
  let start = -1;
  for (let index = colon - 1; index >= 0 && SCHEME_CHAR_PATTERN.test(text[index]); index -= 1) {
    const atWordBoundary = index === 0 || !WORD_CHAR_PATTERN.test(text[index - 1]);
    if (atWordBoundary && SCHEME_START_PATTERN.test(text[index])) {
      start = index;
    }
  }
  return start;
}

// Index of the first match of a global `pattern` at or after `from`, or the text length.
function indexOfPattern(text: string, pattern: RegExp, from: number): number {
  pattern.lastIndex = from;
  const match = pattern.exec(text);
  return match === null ? text.length : match.index;
}

function redactParseableUrlUserinfo(text: string): string {
  const trimmed = text.trim();
  const parsed = tryParseUrl(trimmed);
  if (parsed === null || (parsed.username.length === 0 && parsed.password.length === 0)) {
    return text;
  }
  const split = splitAuthorityUserinfo(trimmed);
  if (split === null) {
    return text;
  }
  const leadingLength = text.length - text.trimStart().length;
  const trailing = text.slice(text.trimEnd().length);
  return `${text.slice(0, leadingLength)}${split.scheme}[REDACTED]@${split.afterAt}${trailing}`;
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function splitAuthorityUserinfo(
  url: string
): { readonly scheme: string; readonly afterAt: string } | null {
  // WHATWG special schemes still expose userinfo for "https:user:pass@host"
  // and for one slash, "https:/user:pass@host".
  const prefix = readSchemePrefix(url);
  if (prefix === null) {
    return null;
  }
  const rest = prefix.rest;
  const slash = rest.indexOf("/");
  const query = rest.indexOf("?");
  const hash = rest.indexOf("#");
  const ends = [slash, query, hash].filter(index => index >= 0);
  const authorityEnd = ends.length === 0 ? rest.length : Math.min(...ends);
  const authority = rest.slice(0, authorityEnd);
  const atIndex = authority.lastIndexOf("@");
  if (atIndex <= 0) {
    return null;
  }
  return {
    scheme: prefix.scheme,
    afterAt: `${authority.slice(atIndex + 1)}${rest.slice(authorityEnd)}`,
  };
}

// A URL inside another URL's path or query ("...?next=https://user:pass@host")
// has its own authority. The text regex sees both as one token.
// One pass per URL in the token, outer first, so a long token of nested URLs
// does not grow the call stack. URLs nested in one authority share its end, and
// the authority reader reads that text once for all of them.
function redactCompactUserinfo(urlToken: string): string {
  // Without an "@" after a URL's scheme there is no userinfo to find, so
  // segments past the last "@" skip the authority scan.
  const lastAt = urlToken.lastIndexOf("@");
  const lastUserinfoAt = lastAtOutsidePathSegmentStart(urlToken);
  const authorities = createAuthorityReader(urlToken);
  const parts: string[] = [];
  let offset = 0;
  for (;;) {
    const prefix = readSchemePrefix(urlToken.slice(offset));
    if (prefix === null) {
      parts.push(urlToken.slice(offset));
      break;
    }
    const restStart = offset + prefix.scheme.length;
    const hasAuthority = prefix.hasAuthoritySlashes || SPECIAL_SCHEMES.has(prefix.name);
    const atIndex =
      hasAuthority && lastAt >= restStart
        ? findUserinfoEnd(urlToken, restStart, authorities, lastAt, lastUserinfoAt)
        : -1;
    const nestedFrom = atIndex > 0 ? atIndex + 1 : 0;
    parts.push(atIndex > 0 ? `${prefix.scheme}[REDACTED]@` : prefix.scheme);
    const rest = prefix.rest.slice(nestedFrom);
    const nestedStart = findNestedUrlStart(rest);
    if (nestedStart === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, nestedStart));
    offset = restStart + nestedFrom + nestedStart;
  }
  return parts.join("");
}

const SCHEME_CHAR_PATTERN = /[a-z0-9+.-]/i;
const SCHEME_START_PATTERN = /[a-z]/i;

// Index of the first match of /[a-z][a-z0-9+.-]*:\S/i, or -1. It walks back
// from each ":" instead of trying every start position, so a long run of
// letters in a path is read once rather than once per letter.
function findNestedUrlStart(text: string): number {
  for (let colon = text.indexOf(":"); colon !== -1; colon = text.indexOf(":", colon + 1)) {
    if (colon + 1 >= text.length || /\s/.test(text[colon + 1])) {
      continue;
    }
    let start = -1;
    for (let index = colon - 1; index >= 0 && SCHEME_CHAR_PATTERN.test(text[index]); index -= 1) {
      if (SCHEME_START_PATTERN.test(text[index])) {
        start = index;
      }
    }
    if (start !== -1) {
      return start;
    }
  }
  return -1;
}

// WHATWG special schemes read userinfo without "//" ("https:user:pass@host").
// Other schemes have an authority only after "//", so "mailto:a@b.com" has none.
const SPECIAL_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "ws:", "wss:", "ftp:"]);

// Path, query, fragment, and the quote or bracket that closes a URL in prose or JSON.
const AUTHORITY_END_PATTERN = /[/\\?#"'<>`]/g;
const DIGITS_PATTERN = /^\d*$/;
const DOTTED_HOST_NAME_PATTERN = /^[a-z0-9_.-]+$/i;
const LOCALHOST_PATTERN = /^localhost$/i;

// The text from a URL's authority start to the next AUTHORITY_END_PATTERN
// character. A URL nested in that authority ("http://[http:[http:…]/@") ends
// at the same character, so the text is read once, from the first start, and a
// later start compares its index with the positions found.
interface AuthorityText {
  readonly end: number;
  // False when no end character follows; `end` is then the token length.
  readonly closed: boolean;
  readonly lastAt: number;
  readonly lastColon: number;
  readonly colonBeforeLast: number;
  // The text after the last ":" is digits, or empty.
  readonly digitsAfterLastColon: boolean;
  // Those digits are above 65535, so they are not a port.
  readonly portTooLarge: boolean;
}

interface AuthorityReader {
  read(start: number): AuthorityText;
  // The first "]" at or after `start`, or the token length.
  closeBracket(start: number): number;
}

// Starts only move forward, and so do both positions here, as in
// splitCommaSeparatedUrls: the authorities of a token are read once in total.
function createAuthorityReader(token: string): AuthorityReader {
  let text: AuthorityText | undefined;
  let closeBracket = -1;
  return {
    read(start) {
      if (text === undefined || text.end < start) {
        text = readAuthorityText(token, start);
      }
      return text;
    },
    closeBracket(start) {
      if (closeBracket < start) {
        const index = token.indexOf("]", start);
        closeBracket = index === -1 ? token.length : index;
      }
      return closeBracket;
    },
  };
}

function readAuthorityText(token: string, from: number): AuthorityText {
  const end = indexOfPattern(token, AUTHORITY_END_PATTERN, from);
  let lastAt = -1;
  let lastColon = -1;
  let colonBeforeLast = -1;
  for (let index = from; index < end; index += 1) {
    if (token[index] === "@") {
      lastAt = index;
    } else if (token[index] === ":") {
      colonBeforeLast = lastColon;
      lastColon = index;
    }
  }
  const port = lastColon === -1 ? "" : token.slice(lastColon + 1, end);
  const digitsAfterLastColon = DIGITS_PATTERN.test(port);
  return {
    end,
    closed: end < token.length,
    lastAt,
    lastColon,
    colonBeforeLast,
    digitsAfterLastColon,
    // WHATWG reads ":0000080" as port 80.
    portTooLarge: digitsAfterLastColon && Number(port) > 65535,
  };
}

// The userinfo ends at the last "@" before the path, so "https://host/a?x=1@2"
// and ".../npm/@scope/pkg" keep their "@". A password with an unencoded "/"
// ("user:p/ss@host") moves that "@" past the first "/"; it is told apart from
// a URL by the "user:p" before the "/", which is not a host[:port].
// A password of digits first ("u:12/ab@host", "u:123?x@host") reads as a port.
// So when the name before the port cannot be a host (a dotted name of letters,
// digits, "-" and "_", localhost, or an IPv6 literal), or the digits are above
// 65535, the last "@" counts unless it starts a path segment ("/@scope"), and
// "gitlab.example:8443/users?search=a@b.com" keeps its "@".
// Two shapes stay ambiguous. A username that is also a dotted host name
// ("first.last:12/ab@host") is left unchanged. A single-label host on a port
// ("gitlab:8080/users?search=a@b.com") is redacted up to that "@".
// `start` is the authority start in `token`; the result is an index from it.
function findUserinfoEnd(
  token: string,
  start: number,
  authorities: AuthorityReader,
  lastAt: number,
  lastUserinfoAt: number
): number {
  const text = authorities.read(start);
  if (text.lastAt >= start || !text.closed) {
    return Math.max(text.lastAt - start, -1);
  }
  const { end, lastColon } = text;
  const hasColon = lastColon >= start;
  const oneColon = hasColon && text.colonBeforeLast < start;
  // ":" and then only digits, maybe none.
  const portDigits = hasColon && text.digitsAfterLastColon;
  const bracketEnd = token[start] === "[" ? authorities.closeBracket(start) : -1;
  // /^(?:\[[^\]]*\]|[^:]*):\d+$/: "host:port" or "[...]:port".
  if (portDigits && lastColon + 1 < end && (oneColon || bracketEnd === lastColon - 1)) {
    const host = token.slice(start, lastColon);
    return !text.portTooLarge && couldBeHostName(host) ? -1 : Math.max(lastUserinfoAt - start, -1);
  }
  // The rest of /^(?:\[[^\]]*\]|[^:]*)(?::\d*)?$/: "host", "host:", "[...]", or "[...]:".
  const hostWithoutPort =
    !hasColon ||
    (oneColon && portDigits) ||
    bracketEnd === end - 1 ||
    (portDigits && bracketEnd === lastColon - 1);
  return hostWithoutPort ? -1 : lastAt - start;
}

// "%" (an encoded "@" in an email username) or "+" cannot appear in a host name.
// The character test comes first and stops at the first other character.
function couldBeHostName(host: string): boolean {
  if (host.startsWith("[")) {
    return host.endsWith("]") && isIP(host.slice(1, -1)) === 6;
  }
  return (
    LOCALHOST_PATTERN.test(host) ||
    (DOTTED_HOST_NAME_PATTERN.test(host) &&
      host.includes(".") &&
      !host.startsWith(".") &&
      !host.includes(".."))
  );
}

// Found once per token, so each nested URL reads it in constant time.
function lastAtOutsidePathSegmentStart(urlToken: string): number {
  let index = urlToken.lastIndexOf("@");
  while (index > 0 && urlToken[index - 1] === "/") {
    index = urlToken.lastIndexOf("@", index - 1);
  }
  return index;
}

const SCHEME_PREFIX_PATTERN = /^([a-z][a-z0-9+.-]*:)(\/\/|\/)?/i;

function readSchemePrefix(value: string): {
  readonly scheme: string;
  readonly name: string;
  readonly hasAuthoritySlashes: boolean;
  readonly rest: string;
} | null {
  const schemeMatch = SCHEME_PREFIX_PATTERN.exec(value);
  if (schemeMatch === null) {
    return null;
  }
  const scheme = schemeMatch[0];
  return {
    scheme,
    name: schemeMatch[1].toLowerCase(),
    hasAuthoritySlashes: schemeMatch[2] === "//",
    rest: value.slice(scheme.length),
  };
}

// A comma is inside a password when the entry's authority is still open (no
// "@", "/", "?", or "#" after the scheme yet) and the next of those after the
// comma, or whitespace, is an "@".
const AUTHORITY_CLOSE_PATTERN = /[@/?#]/g;
const USERINFO_STOP_PATTERN = /[@/?# \t]/g;

export function splitCommaSeparatedUrls(value: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  // Where the current entry's authority starts, -1 without a scheme; read at its first comma.
  let restStart: number | undefined;
  let inUserinfo = false;
  // Both positions only move forward, so a value with many commas is read once.
  let closeIndex = -1;
  let stopIndex = -1;
  for (let comma = value.indexOf(","); comma !== -1; comma = value.indexOf(",", comma + 1)) {
    if (restStart === undefined) {
      restStart = readRestStart(value, start, comma);
    }
    if (restStart !== -1) {
      if (closeIndex < restStart) {
        closeIndex = indexOfPattern(value, AUTHORITY_CLOSE_PATTERN, restStart);
      }
      if (stopIndex < comma) {
        stopIndex = indexOfPattern(value, USERINFO_STOP_PATTERN, comma + 1);
      }
      const commaInUserinfo =
        closeIndex > comma &&
        value[stopIndex] === "@" &&
        (inUserinfo || !startsNextUrl(value, start, comma));
      if (commaInUserinfo) {
        inUserinfo = true;
        continue;
      }
    }
    parts.push(value.slice(start, comma).trim());
    start = comma + 1;
    restStart = undefined;
    inUserinfo = false;
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function readRestStart(value: string, start: number, comma: number): number {
  const raw = value.slice(start, comma);
  const prefix = readSchemePrefix(raw.trim());
  if (prefix === null) {
    return -1;
  }
  return start + raw.length - raw.trimStart().length + prefix.scheme.length;
}

// "https://a.example,https:user:pass@b.example" is two URLs; the "@" after the
// comma belongs to the next one. The text before the comma must parse as a URL
// by itself, so "https://alice:secret,https:word@host" stays one entry.
// Only http(s) counts, so "pass,abc:def@host" stays. Checked at an entry's
// first comma only: once a comma is in the password, so is every comma up to its "@".
const NEXT_HTTP_URL_PATTERN = /https?:/iy;

function startsNextUrl(value: string, start: number, comma: number): boolean {
  NEXT_HTTP_URL_PATTERN.lastIndex = comma + 1;
  return (
    NEXT_HTTP_URL_PATTERN.test(value) && tryParseUrl(value.slice(start, comma).trim()) !== null
  );
}

// "user:pa ss@host" is a password. "localhost:3000 a@b.com" is a host, then an email.
// A numeric port counts only when one token follows it and the text after "@" is an email domain.
function looksLikeHostPort(userinfo: string, afterAt: string): boolean {
  const colon = userinfo.indexOf(":");
  if (colon <= 0) {
    return false;
  }
  const host = userinfo.slice(0, colon);
  const portMatch = /^([^\s]+)/.exec(userinfo.slice(colon + 1));
  const port = portMatch?.[1] ?? "";
  if (port.length === 0) {
    return false;
  }
  if (/^\d+$/.test(port)) {
    const remainder = userinfo.slice(colon + 1 + port.length).trim();
    const firstTokenEnd = afterAt.search(/\s/);
    const firstToken = firstTokenEnd === -1 ? afterAt : afterAt.slice(0, firstTokenEnd);
    return (
      remainder.length > 0 &&
      !/\s/.test(remainder) &&
      firstToken.length > 0 &&
      !/[/:@]/.test(firstToken)
    );
  }
  return host.toLowerCase() === "localhost";
}
