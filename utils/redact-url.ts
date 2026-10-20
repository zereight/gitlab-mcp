const SENSITIVE_QUERY_NAMES: ReadonlySet<string> = new Set([
  "access_token",
  "private_token",
  "job_token",
  "password",
  "token",
]);

/**
 * Removes userinfo from a GitLab API URL before it is returned to the client.
 * A password with an unencoded slash is not a valid WHATWG URL, so that form
 * uses the same text redaction as transport error messages.
 */
export function redactGitLabUrlCredentials(url: string): string {
  try {
    const parsed = new URL(url);
    const hadUserinfo = parsed.username.length > 0 || parsed.password.length > 0;
    if (hadUserinfo) {
      parsed.username = "";
      parsed.password = "";
    }
    const serialized = hadUserinfo ? parsed.toString() : url;
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
  return url.replace(
    /([?&#])([^=&\s#]+)=[^&\s#]+/g,
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

function redactUrlUserinfoInText(message: string): string {
  // A token can hold a comma-separated GITLAB_API_URL list; each entry has its own userinfo.
  const withoutCompactUserinfo = message.replace(
    /\b[a-z][a-z0-9+.-]*:(?:\/\/|\/)?[^\s]+/gi,
    urlToken => splitCommaSeparatedUrls(urlToken).map(redactCompactUserinfo).join(",")
  );
  return withoutCompactUserinfo.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@.]+(?::[^\s/:@.]+)+(?:\s+[^\s/:@.]+)+)@/gi,
    (match: string, scheme: string, userinfo: string, offset: number, source: string) => {
      if (looksLikeHostPort(userinfo, source.slice(offset + match.length))) {
        return match;
      }
      return `${scheme}[REDACTED]@`;
    }
  );
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
    const atIndex = hasAuthority && lastAt >= restStart ? findUserinfoEnd(prefix.rest) : -1;
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

// The userinfo ends at the last "@" before the path, so "https://host/a?x=1@2"
// and ".../npm/@scope/pkg" keep their "@". A password with an unencoded "/"
// ("user:p/ss@host") moves that "@" past the first "/"; it is told apart from
// a URL by the "user:p" before the "/", which is not a host[:port].
function findUserinfoEnd(rest: string): number {
  const authorityEnd = rest.search(AUTHORITY_END_PATTERN);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const atIndex = authority.lastIndexOf("@");
  if (atIndex !== -1 || authorityEnd === -1 || HOST_PORT_PATTERN.test(authority)) {
    return atIndex;
  }
  return rest.lastIndexOf("@");
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

export function splitCommaSeparatedUrls(value: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ",") {
      continue;
    }
    if (commaIsInsideUserinfo(value, start, index)) {
      continue;
    }
    parts.push(value.slice(start, index).trim());
    start = index + 1;
  }
  parts.push(value.slice(start).trim());
  return parts;
}

// "https://a.example,https:user:pass@b.example" is two URLs; the "@" after the
// comma belongs to the next one. The text before the comma must parse as a URL
// by itself, so "https://alice:secret,https:word@host" stays one entry.
// Only http(s) counts, so "pass,abc:def@host" stays.
const NEXT_HTTP_URL_PATTERN = /^https?:/i;

function commaIsInsideUserinfo(value: string, start: number, commaIndex: number): boolean {
  const entry = value.slice(start, commaIndex).trim();
  const prefix = readSchemePrefix(entry);
  if (prefix === null || authorityAlreadyClosed(prefix.rest)) {
    return false;
  }
  const afterComma = value.slice(commaIndex + 1);
  const startsNextUrl = NEXT_HTTP_URL_PATTERN.test(afterComma) && tryParseUrl(entry) !== null;
  return !startsNextUrl && userinfoAtFollows(afterComma);
}

function authorityAlreadyClosed(rest: string): boolean {
  return rest.includes("@") || rest.includes("/") || rest.includes("?") || rest.includes("#");
}

function userinfoAtFollows(afterComma: string): boolean {
  for (let index = 0; index < afterComma.length; index += 1) {
    const char = afterComma[index];
    if (char === "@") {
      return true;
    }
    if (char === "/" || char === "?" || char === "#" || char === " " || char === "\t") {
      return false;
    }
  }
  return false;
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
