/**
 * Produce a safe short form of a session id for logs. Legacy UUIDs pass
 * through; stateless sealed sids are truncated to the "v1.sid." prefix
 * plus a handful of bytes of the ciphertext so operators can correlate
 * flows without the log line carrying the sealed bearer token.
 */
export function redactSessionIdForLog(sid: string | undefined): string {
  if (!sid) return "<none>";
  if (sid.startsWith("v1.sid.")) return "v1.sid.<redacted>";
  // UUIDs / other formats are low-sensitivity; show first 8 chars.
  return sid.length > 8 ? `${sid.slice(0, 8)}…` : sid;
}

/**
 * Detect whether an MCP JSON-RPC request body represents an "initialize"
 * request. Accepts both single-message and batch forms. Returns false on any
 * unexpected shape — callers treat an ambiguous body as non-init, which is
 * the safer default (it means the SDK will fail loudly rather than silently
 * spawning a new session).
 */
export function isInitializationRequestBody(body: unknown): boolean {
  if (!body) return false;
  const isInitObj = (m: unknown): boolean =>
    typeof m === "object" && m !== null && (m as { method?: unknown }).method === "initialize";
  if (Array.isArray(body)) return body.some(isInitObj);
  return isInitObj(body);
}

export function isUnauthenticatedDiscoveryRequestBody(body: unknown): boolean {
  if (!body) return false;
  const isDiscoveryMethod = (m: unknown): boolean => {
    if (typeof m !== "object" || m === null) return false;
    const method = (m as { method?: unknown }).method;
    return (
      method === "initialize" || method === "notifications/initialized" || method === "tools/list"
    );
  };
  if (Array.isArray(body)) return body.every(isDiscoveryMethod);
  return isDiscoveryMethod(body);
}

/**
 * Normalize an `Mcp-Session-Id` header value.
 *
 * Node's HTTP types allow any request header to surface as `string[]` when
 * the client sends it more than once. Casting to `string` and calling
 * `.startsWith()` on an array throws `TypeError: startsWith is not a
 * function`, which Express converts to a 500 — silently turning malformed
 * requests into server errors and breaking the 401/404 semantics we
 * carefully distinguish in stateless mode. A duplicated `Mcp-Session-Id` is
 * also ill-formed at the protocol level: there is no well-defined way to
 * pick between two values, so we reject arrays rather than guess.
 *
 * Empty-string is normalized to `undefined` so call sites can use truthy
 * checks and `?? undefined`-style fallbacks uniformly.
 */
export function readMcpSessionIdHeader(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | undefined {
  const raw = req.headers["mcp-session-id"];
  if (typeof raw !== "string") return undefined;
  return raw.length > 0 ? raw : undefined;
}
