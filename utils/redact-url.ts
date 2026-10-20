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
 * A thrown string is returned redacted; other values are returned unchanged.
 */
export function redactUrlSecretsInError(error: unknown): unknown {
  if (typeof error === "string") {
    return redactUrlSecretsInText(error);
  }
  redactErrorChain(error, new Set());
  return error;
}

/**
 * The redacted message of a caught error, for a tool result that reports the
 * failure in its data (`{ "error": "GraphQL request failed: ..." }`) instead of
 * as an isError result.
 */
export function redactUrlSecretsInErrorMessage(error: unknown): string {
  return redactUrlSecretsInText(error instanceof Error ? error.message : String(error));
}

function redactErrorChain(error: unknown, seen: Set<Error>): void {
  if (!(error instanceof Error) || seen.has(error)) {
    return;
  }
  seen.add(error);
  redactErrorField(error, "message");
  redactErrorField(error, "stack");
  if (typeof error.cause === "string") {
    redactErrorField(error, "cause");
  } else {
    redactErrorChain(error.cause, seen);
  }
  if (error instanceof AggregateError && Array.isArray(error.errors)) {
    for (const inner of error.errors) {
      redactErrorChain(inner, seen);
    }
  }
}

function redactErrorField(error: Error, field: "message" | "stack" | "cause"): void {
  const value: unknown = error[field];
  if (typeof value !== "string") {
    return;
  }
  const redacted = redactUrlSecretsInText(value);
  if (redacted === value) {
    return;
  }
  try {
    error[field] = redacted;
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
// does not grow the call stack.
function redactCompactUserinfo(urlToken: string): string {
  // Without an "@" after a URL's scheme there is no userinfo to find, so
  // segments past the last "@" skip the authority scan.
  const lastAt = urlToken.lastIndexOf("@");
  const lastUserinfoAt = lastAtOutsidePathSegmentStart(urlToken);
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
        ? findUserinfoEnd(prefix.rest, lastUserinfoAt - restStart)
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
const AUTHORITY_END_PATTERN = /[/\\?#"'<>`]/;
const HOST_PORT_PATTERN = /^(?:\[[^\]]*\]|[^:]*)(?::\d*)?$/;
const HOST_WITH_PORT_PATTERN = /^(?:\[[^\]]*\]|[^:]*):\d+$/;
const DOTTED_HOST_NAME_PATTERN = /^[a-z0-9_.-]+$/i;

// The userinfo ends at the last "@" before the path, so "https://host/a?x=1@2"
// and ".../npm/@scope/pkg" keep their "@". A password with an unencoded "/"
// ("user:p/ss@host") moves that "@" past the first "/"; it is told apart from
// a URL by the "user:p" before the "/", which is not a host[:port].
// A password of digits first ("u:12/ab@host", "u:123?x@host") reads as a port.
// So when the name before the port cannot be a host (no ".", not localhost,
// not an IP literal), the last "@" counts unless it starts a path segment
// ("/@scope"), and "gitlab.example:8443/users?search=a@b.com" keeps its "@".
// Two shapes stay ambiguous. A username that is also a dotted host name
// ("first.last:12/ab@host") is left unchanged. A single-label host on a port
// ("gitlab:8080/users?search=a@b.com") is redacted up to that "@".
// `lastUserinfoAt` is that "@" as an index into `rest`, or negative.
function findUserinfoEnd(rest: string, lastUserinfoAt: number): number {
  const authorityEnd = rest.search(AUTHORITY_END_PATTERN);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const atIndex = authority.lastIndexOf("@");
  if (atIndex !== -1 || authorityEnd === -1) {
    return atIndex;
  }
  if (HOST_WITH_PORT_PATTERN.test(authority)) {
    const host = authority.slice(0, authority.lastIndexOf(":"));
    return couldBeHostName(host) ? -1 : Math.max(lastUserinfoAt, -1);
  }
  if (HOST_PORT_PATTERN.test(authority)) {
    return -1;
  }
  return rest.lastIndexOf("@");
}

// "%" (an encoded "@" in an email username) or "+" cannot appear in a host name.
function couldBeHostName(host: string): boolean {
  if ((host.startsWith("[") && host.endsWith("]")) || host.toLowerCase() === "localhost") {
    return true;
  }
  return (
    host.includes(".") &&
    !host.startsWith(".") &&
    !host.includes("..") &&
    DOTTED_HOST_NAME_PATTERN.test(host)
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
