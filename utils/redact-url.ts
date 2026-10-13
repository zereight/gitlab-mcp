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
  const withoutCompactUserinfo = message.replace(
    /\b[a-z][a-z0-9+.-]*:(?:\/\/|\/)?[^\s]+/gi,
    urlToken => redactCompactUserinfo(urlToken)
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

function redactCompactUserinfo(urlToken: string): string {
  const prefix = readSchemePrefix(urlToken);
  if (prefix === null) {
    return urlToken;
  }
  const atIndex = prefix.rest.lastIndexOf("@");
  if (atIndex <= 0) {
    return urlToken;
  }
  return `${prefix.scheme}[REDACTED]@${prefix.rest.slice(atIndex + 1)}`;
}

const SCHEME_PREFIX_PATTERN = /^([a-z][a-z0-9+.-]*:)(\/\/|\/)?/i;

function readSchemePrefix(
  value: string
): { readonly scheme: string; readonly rest: string } | null {
  const schemeMatch = SCHEME_PREFIX_PATTERN.exec(value);
  if (schemeMatch === null) {
    return null;
  }
  const scheme = schemeMatch[0];
  return {
    scheme,
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

function commaIsInsideUserinfo(value: string, start: number, commaIndex: number): boolean {
  const prefix = readSchemePrefix(value.slice(start, commaIndex).trimStart());
  if (prefix === null || authorityAlreadyClosed(prefix.rest)) {
    return false;
  }
  return userinfoAtFollows(value.slice(commaIndex + 1));
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
