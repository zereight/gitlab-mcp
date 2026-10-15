/**
 * Callback-proxy safeguards (GITLAB_OAUTH_CALLBACK_PROXY=true).
 *
 * In callback-proxy mode GitLab only sees the server's fixed /callback URL,
 * so GitLab cannot check where the proxy authorization code goes next. Any
 * caller can register a client through DCR, so two checks run on this server
 * before the user is sent to GitLab:
 *
 * 1. The client's redirect_uri must match GITLAB_OAUTH_ALLOWED_REDIRECT_URIS
 *    (default: known MCP client callbacks plus loopback).
 * 2. The user approves the client on a consent page that shows where the
 *    code will be sent. Approval is remembered per client_id + redirect_uri
 *    in a signed cookie.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { redirectUriMatches } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import type { AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

import { deriveSubkey, STATELESS_PURPOSES } from "./stateless/index.js";
import type { StatelessKeyMaterial } from "./stateless/index.js";

// ---------------------------------------------------------------------------
// Redirect URI allowlist
// ---------------------------------------------------------------------------

/**
 * Callbacks accepted when GITLAB_OAUTH_ALLOWED_REDIRECT_URIS is unset.
 * Loopback entries accept any port (RFC 8252 §7.3) and any path.
 */
export const DEFAULT_ALLOWED_REDIRECT_URIS: readonly string[] = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  "https://chatgpt.com/connector_platform_oauth_redirect",
  "https://chatgpt.com/connector/oauth/*",
  "cursor://anysphere.cursor-mcp/oauth/callback",
  "http://localhost/*",
  "http://127.0.0.1/*",
  "http://[::1]/*",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

type RedirectRule =
  | { kind: "any" }
  | { kind: "exact"; uri: string }
  | { kind: "prefix"; base: URL };

function parseRule(entry: string): RedirectRule {
  if (entry === "*") return { kind: "any" };
  const isPrefix = entry.endsWith("*");
  const raw = isPrefix ? entry.slice(0, -1) : entry;
  if (raw.includes("*")) {
    throw new Error(`GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "${entry}" may only use * at the end`);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "${entry}" is not a valid URL`);
  }
  if (url.hash || url.username || url.password) {
    throw new Error(
      `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "${entry}" must not contain a fragment or credentials`
    );
  }
  if (!isPrefix) return { kind: "exact", uri: entry };
  // Require "/*" so "https://client.example/app*" cannot be read as also
  // covering /application or /app-evil.
  if (!raw.endsWith("/") || url.search) {
    throw new Error(
      `GITLAB_OAUTH_ALLOWED_REDIRECT_URIS: "${entry}" must end with "/*", e.g. https://client.example/oauth/*`
    );
  }
  return { kind: "prefix", base: url };
}

function ruleMatches(rule: RedirectRule, requested: string, url: URL): boolean {
  switch (rule.kind) {
    case "any":
      return true;
    case "exact":
      return redirectUriMatches(requested, rule.uri);
    case "prefix": {
      const { base } = rule;
      if (url.protocol !== base.protocol || url.hostname !== base.hostname) return false;
      if (!LOOPBACK_HOSTS.has(base.hostname) && url.port !== base.port) return false;
      // URL parsing already resolved "." / ".." segments.
      return url.pathname.startsWith(base.pathname);
    }
  }
}

/**
 * Split a GITLAB_OAUTH_ALLOWED_REDIRECT_URIS value into entries. Unset or
 * empty means the defaults; the token "defaults" expands to them inside a
 * list so operators can add entries without copying the built-in ones.
 */
export function parseAllowedRedirectUris(raw: string | undefined): string[] {
  const parts = (raw ?? "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [...DEFAULT_ALLOWED_REDIRECT_URIS];
  return parts.flatMap(part => (part === "defaults" ? [...DEFAULT_ALLOWED_REDIRECT_URIS] : [part]));
}

export class RedirectUriPolicy {
  private readonly _rules: RedirectRule[];
  readonly entries: readonly string[];

  constructor(entries: readonly string[]) {
    this.entries = [...entries];
    this._rules = entries.map(parseRule);
  }

  /** True when the operator opted out with "*". */
  get allowsAny(): boolean {
    return this._rules.some(rule => rule.kind === "any");
  }

  allows(redirectUri: string): boolean {
    let url: URL;
    try {
      url = new URL(redirectUri);
    } catch {
      return false;
    }
    // OAuth redirect URIs must not carry a fragment (RFC 6749 §3.1.2).
    if (url.hash || url.username || url.password) return false;
    return this._rules.some(rule => ruleMatches(rule, redirectUri, url));
  }
}

// ---------------------------------------------------------------------------
// Consent page
// ---------------------------------------------------------------------------

const CSRF_COOKIE = "gitlab_mcp_oauth_csrf";
const CONSENT_COOKIE_PREFIX = "gitlab_mcp_oauth_consent_";
const CSRF_TTL_SECONDS = 10 * 60;
export const CONSENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const CSRF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_CLIENT_NAME_LENGTH = 80;

export interface ConsentGateOptions {
  /** Shown as the service name on the page. */
  resourceName: string;
  /** Set for https deployments: adds Secure and the __Host- cookie prefix. */
  secureCookies: boolean;
  /**
   * Stateless key material. When set, remembered approvals are signed with a
   * key derived from OAUTH_STATELESS_SECRET so every pod accepts them.
   */
  stateless?: StatelessKeyMaterial | null;
}

/** "proceed" = continue to GitLab; "handled" = a response was already sent. */
export type ConsentOutcome = "proceed" | "handled";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!cookies.has(name)) cookies.set(name, part.slice(eq + 1).trim());
  }
  return cookies;
}

function bodyField(body: unknown, name: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function describeRedirect(redirectUri: string): string {
  const url = new URL(redirectUri);
  if (LOOPBACK_HOSTS.has(url.hostname)) {
    return `an app on your own computer (${url.protocol}//${url.host})`;
  }
  return `${url.protocol}//${url.host}`;
}

export class ConsentGate {
  private readonly _resourceName: string;
  private readonly _secure: boolean;
  private readonly _rememberKey: Buffer;

  constructor(options: ConsentGateOptions) {
    this._resourceName = options.resourceName;
    this._secure = options.secureCookies;
    // Without stateless material the key is per process: approvals are asked
    // again after a restart, which is the safe direction.
    this._rememberKey = options.stateless
      ? deriveSubkey(options.stateless, "current", STATELESS_PURPOSES.OAUTH_CONSENT)
      : randomBytes(32);
  }

  /**
   * Decide whether /authorize may continue to GitLab. Shows the consent page
   * on first use, checks the submitted form, and honours a remembered approval.
   */
  check(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): ConsentOutcome {
    const req = res.req as Request | undefined;
    const cookies = parseCookies(req?.headers?.cookie);
    const action = req?.method === "POST" ? bodyField(req.body, "consent_action") : undefined;

    if (action !== undefined) {
      const submitted = bodyField(req!.body, "consent_csrf");
      const expected = cookies.get(this._cookieName(CSRF_COOKIE));
      if (!submitted || !expected || !safeEqual(submitted, expected)) {
        this._sendPage(
          res,
          403,
          "Approval expired",
          "<p>This approval form expired or was not sent from this server. Start the sign-in again from your MCP client.</p>"
        );
        return "handled";
      }
      if (action !== "approve") {
        const target = new URL(params.redirectUri);
        target.searchParams.set("error", "access_denied");
        target.searchParams.set("error_description", "The user denied the request");
        if (params.state) target.searchParams.set("state", params.state);
        res.redirect(302, target.toString());
        return "handled";
      }
      this._rememberApproval(res, client.client_id, params.redirectUri);
      return "proceed";
    }

    if (this._isRemembered(cookies, client.client_id, params.redirectUri)) return "proceed";

    this._renderConsent(res, cookies, client, params);
    return "handled";
  }

  private _cookieName(base: string): string {
    // __Host- cookies cannot be set or overwritten by sibling subdomains.
    return this._secure ? `__Host-${base}` : base;
  }

  private _cookieAttributes(maxAgeSeconds: number): string {
    return `Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${this._secure ? "; Secure" : ""}`;
  }

  private _approvalCookieName(clientId: string, redirectUri: string): string {
    const digest = createHash("sha256").update(`${clientId}\n${redirectUri}`).digest("hex");
    return this._cookieName(`${CONSENT_COOKIE_PREFIX}${digest.slice(0, 16)}`);
  }

  private _approvalSignature(clientId: string, redirectUri: string, expiresAt: number): string {
    return createHmac("sha256", this._rememberKey)
      .update(`v1\n${clientId}\n${redirectUri}\n${expiresAt}`)
      .digest("base64url");
  }

  private _isRemembered(
    cookies: Map<string, string>,
    clientId: string,
    redirectUri: string
  ): boolean {
    const value = cookies.get(this._approvalCookieName(clientId, redirectUri));
    if (!value) return false;
    const [expiresRaw, signature] = value.split(".");
    const expiresAt = Number(expiresRaw);
    if (!signature || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
      return false;
    }
    return safeEqual(signature, this._approvalSignature(clientId, redirectUri, expiresAt));
  }

  private _rememberApproval(res: Response, clientId: string, redirectUri: string): void {
    const expiresAt = Math.floor(Date.now() / 1000) + CONSENT_TTL_SECONDS;
    const value = `${expiresAt}.${this._approvalSignature(clientId, redirectUri, expiresAt)}`;
    res.setHeader("Set-Cookie", [
      `${this._approvalCookieName(clientId, redirectUri)}=${value}; ${this._cookieAttributes(CONSENT_TTL_SECONDS)}`,
      `${this._cookieName(CSRF_COOKIE)}=; ${this._cookieAttributes(0)}`,
    ]);
  }

  private _renderConsent(
    res: Response,
    cookies: Map<string, string>,
    client: OAuthClientInformationFull,
    params: AuthorizationParams
  ): void {
    // Reuse a live token so two open sign-in tabs do not invalidate each other.
    const existing = cookies.get(this._cookieName(CSRF_COOKIE));
    const csrf =
      existing && CSRF_TOKEN_PATTERN.test(existing)
        ? existing
        : randomBytes(32).toString("base64url");
    res.setHeader(
      "Set-Cookie",
      `${this._cookieName(CSRF_COOKIE)}=${csrf}; ${this._cookieAttributes(CSRF_TTL_SECONDS)}`
    );

    const rawName = client.client_name?.trim() || "Unnamed client";
    const clientName =
      rawName.length > MAX_CLIENT_NAME_LENGTH
        ? `${rawName.slice(0, MAX_CLIENT_NAME_LENGTH)}…`
        : rawName;
    const fields: Record<string, string | undefined> = {
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      response_type: "code",
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      scope: params.scopes && params.scopes.length > 0 ? params.scopes.join(" ") : undefined,
      state: params.state,
      resource: params.resource?.href,
      consent_csrf: csrf,
    };
    const hidden = Object.entries(fields)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
      .join("\n      ");
    const scopes = params.scopes && params.scopes.length > 0 ? params.scopes.join(", ") : "default";

    this._sendPage(
      res,
      200,
      "Approve MCP client",
      `<p>An MCP client wants to use ${escapeHtml(this._resourceName)} with your GitLab account.</p>
    <p class="label">After you sign in to GitLab, access is sent to</p>
    <p class="target">${escapeHtml(describeRedirect(params.redirectUri))}</p>
    <p class="uri">${escapeHtml(params.redirectUri)}</p>
    <p class="label">Client name (chosen by the client, not verified)</p>
    <p>${escapeHtml(clientName)}</p>
    <p class="label">Requested scopes</p>
    <p>${escapeHtml(scopes)}</p>
    <p class="warn">Approve only if you started this sign-in from your own MCP client and you recognize the address above.</p>
    <form method="post">
      ${hidden}
      <button type="submit" name="consent_action" value="approve">Approve</button>
      <button type="submit" name="consent_action" value="deny">Deny</button>
    </form>`
    );
  }

  private _sendPage(res: Response, status: number, title: string, body: string): void {
    // No form-action directive: browsers apply it to the redirects that follow
    // the POST (GitLab, then the client callback).
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
    );
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(status).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem; color: #1f1f1f; }
    .label { margin-bottom: 0.2rem; color: #555; font-size: 0.9rem; }
    .label + p { margin-top: 0; }
    .target { font-size: 1.25rem; font-weight: 600; }
    .uri { word-break: break-all; color: #555; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .warn { margin: 1.5rem 0; }
    button { font-size: 1rem; padding: 0.5rem 1.25rem; margin-right: 0.5rem; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${body}
  </main>
</body>
</html>`);
  }
}
