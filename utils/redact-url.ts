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
  return redactSensitiveQuery(redactUrlUserinfoInText(text));
}

function redactSensitiveQuery(url: string): string {
  return url.replace(/([?&])([^=&\s#]+)=[^&\s#]+/g, (match, separator: string, rawName: string) => {
    if (!isSensitiveQueryName(rawName)) {
      return match;
    }
    return `${separator}${rawName}=[REDACTED]`;
  });
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
  const withoutCompactUserinfo = message.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s]+/gi, urlToken =>
    redactCompactUserinfo(urlToken)
  );
  return withoutCompactUserinfo.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@.]+(?::[^\s/:@.]+)+(?:\s+[^\s/:@.]+)+)@/gi,
    (match, scheme: string, userinfo: string) => {
      if (looksLikeHostPort(userinfo)) {
        return match;
      }
      return `${scheme}[REDACTED]@`;
    }
  );
}

function redactCompactUserinfo(urlToken: string): string {
  const schemeIndex = urlToken.indexOf("://");
  const rest = urlToken.slice(schemeIndex + 3);
  const atIndex = rest.lastIndexOf("@");
  if (atIndex <= 0) {
    return urlToken;
  }
  return `${urlToken.slice(0, schemeIndex + 3)}[REDACTED]@${rest.slice(atIndex + 1)}`;
}

// "user:pa ss@host" is a password with a space. "localhost:3000 a@b.com" is a host, then an email.
function looksLikeHostPort(userinfo: string): boolean {
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
    return true;
  }
  return host.toLowerCase() === "localhost";
}
