const SENSITIVE_QUERY_PATTERN =
  /([?&](?:access_token|private_token|job_token|password|token)=)[^&\s#]+/gi;

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
  return url.replace(SENSITIVE_QUERY_PATTERN, "$1[REDACTED]");
}

function redactUrlUserinfoInText(message: string): string {
  return message.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s]+/gi, urlToken => {
    const schemeIndex = urlToken.indexOf("://");
    const rest = urlToken.slice(schemeIndex + 3);
    const atIndex = rest.lastIndexOf("@");
    if (atIndex <= 0) {
      return urlToken;
    }
    return `${urlToken.slice(0, schemeIndex + 3)}[REDACTED]@${rest.slice(atIndex + 1)}`;
  });
}
