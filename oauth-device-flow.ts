import { z } from "zod";

const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_SECONDS = 5;
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const DeviceAuthorizationSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  verification_uri_complete: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  interval: z.number().nonnegative().optional(),
});

const DeviceTokenErrorSchema = z.object({
  error: z.string().min(1),
  error_description: z.string().optional(),
});

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
  token_type: z.string().min(1).optional(),
  scope: z.string().nullish(),
});

export interface DeviceFlowTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  created_at: number;
  token_type: string;
  scopes?: string[];
}

/**
 * Extra scopes that may accompany a matching grant without forcing a new login.
 * Each one is read-only in GitLab's OAuth scope table. Write-capable scopes
 * (`api`, `write_repository`, `sudo`, runner/admin scopes) and anything not
 * listed here are unapproved and must be authorized again.
 */
const APPROVED_EXTRA_READ_SCOPES: ReadonlySet<string> = new Set([
  "read_api",
  "read_user",
  "read_repository",
  "read_registry",
  "read_virtual_registry",
  "read_observability",
  "openid",
  "profile",
  "email",
]);

/**
 * Scopes GitLab actually returned.
 * A missing or blank `scope` field is not an observation. Keep a grant this
 * process already recorded; otherwise leave the grant unknown instead of
 * copying the scopes we requested.
 */
export function grantedOAuthScopes(
  scopeField: unknown,
  recordedScopes?: readonly string[]
): string[] | undefined {
  if (typeof scopeField === "string") {
    const scopes = scopeField.split(/\s+/).filter(scope => scope.length > 0);
    if (scopes.length > 0) {
      return scopes;
    }
  }
  if (recordedScopes !== undefined && recordedScopes.length > 0) {
    return [...recordedScopes];
  }
  return undefined;
}

/**
 * True when a stored grant cannot be reused for the scopes this process requires.
 * A missing or empty scope list is a pre-upgrade file. Those tokens keep working:
 * a missing field is not a known mismatch, and forcing a browser login hangs
 * headless and device-flow users. The next refresh records the scopes GitLab returns.
 * Extra scopes stay valid only when they are on the approved read-only list, so a
 * GitLab response that adds `read_user` does not force a login loop.
 */
export function oauthTokenNeedsReauthorization(
  storedScopes: readonly string[] | undefined,
  expectedScopes: readonly string[]
): boolean {
  if (storedScopes === undefined || storedScopes.length === 0) {
    return false;
  }
  const stored = new Set(storedScopes);
  const expected = new Set(expectedScopes);
  for (const scope of expected) {
    if (!stored.has(scope)) {
      return true;
    }
  }
  for (const scope of stored) {
    if (!expected.has(scope) && !APPROVED_EXTRA_READ_SCOPES.has(scope)) {
      return true;
    }
  }
  return false;
}

export function formatOAuthScopes(scopes: readonly string[] | undefined): string {
  if (scopes === undefined || scopes.length === 0) {
    return "missing";
  }
  return scopes.map(scope => scope.replace(/[\r\n]/g, "")).join(" ");
}

export function oauthScopeMismatchError(
  grantedScopes: readonly string[] | undefined,
  expectedScopes: readonly string[]
): Error {
  return new Error(
    `OAuth authorization granted scopes (${formatOAuthScopes(grantedScopes)}), ` +
      `which do not match required scopes (${formatOAuthScopes(expectedScopes)}).`
  );
}

function assertGrantedScopesMatchRequest(
  grantedScopes: readonly string[] | undefined,
  expectedScopes: readonly string[]
): void {
  if (oauthTokenNeedsReauthorization(grantedScopes, expectedScopes)) {
    throw oauthScopeMismatchError(grantedScopes, expectedScopes);
  }
}

export interface DeviceUserCodeInfo {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
}

export type FetchImpl = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface DeviceAuthorizationGrantInput {
  gitlabUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  fetchImpl?: FetchImpl;
  sleepAsync?: (ms: number) => Promise<void>;
  onUserCode?: (info: DeviceUserCodeInfo) => void;
  now?: () => number;
}

function delayAsync(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function readJsonBodyAsync(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function gitlabOrigin(gitlabUrl: string): string {
  return gitlabUrl.replace(/\/$/, "");
}

function formatOauthError(errorCode: string, description?: string): string {
  if (description) {
    return `${errorCode}: ${description}`;
  }
  return errorCode;
}

function unsupportedDeviceFlowMessage(status: number): string {
  return (
    `Device authorization is not available on this GitLab instance (HTTP ${status}). ` +
    "GitLab 17.9+ is required for `zereight-mcp-gitlab auth` " +
    "(17.2–17.8 need oauth2_device_grant_flow). " +
    "Use a Personal Access Token (GITLAB_PERSONAL_ACCESS_TOKEN) instead."
  );
}

/**
 * RFC 8628 Device Authorization Grant against GitLab (17.9+; 17.2–17.8 with
 * oauth2_device_grant_flow).
 * Does not open a browser. Never logs device_code or tokens.
 */
export async function runDeviceAuthorizationGrantAsync(
  input: DeviceAuthorizationGrantInput
): Promise<DeviceFlowTokenData> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const sleepAsync = input.sleepAsync ?? delayAsync;
  const now = input.now ?? Date.now;
  const origin = gitlabOrigin(input.gitlabUrl);

  const authorizeParams = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scopes.join(" "),
  });

  const authorizeResponse = await fetchImpl(`${origin}/oauth/authorize_device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: authorizeParams.toString(),
  });

  if (authorizeResponse.status === 404) {
    throw new Error(unsupportedDeviceFlowMessage(404));
  }

  const authorizeBody = await readJsonBodyAsync(authorizeResponse);
  if (!authorizeResponse.ok) {
    const parsedError = DeviceTokenErrorSchema.safeParse(authorizeBody);
    if (parsedError.success) {
      throw new Error(
        `Device authorization request failed: ${formatOauthError(
          parsedError.data.error,
          parsedError.data.error_description
        )}`
      );
    }
    if (authorizeResponse.status >= 400 && authorizeResponse.status < 500) {
      throw new Error(unsupportedDeviceFlowMessage(authorizeResponse.status));
    }
    throw new Error(`Device authorization request failed (HTTP ${authorizeResponse.status}).`);
  }

  const authorization = DeviceAuthorizationSchema.safeParse(authorizeBody);
  if (!authorization.success) {
    throw new Error("Device authorization endpoint returned an invalid response.");
  }

  const {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    expires_in: expiresIn,
    interval: rawInterval,
  } = authorization.data;

  input.onUserCode?.({
    userCode,
    verificationUri,
    verificationUriComplete,
  });

  let intervalSeconds =
    rawInterval === undefined || rawInterval <= 0
      ? DEFAULT_POLL_INTERVAL_SECONDS
      : rawInterval;
  const deadline = now() + expiresIn * 1000;
  const tokenUrl = `${origin}/oauth/token`;

  while (now() < deadline) {
    const tokenParams = new URLSearchParams({
      grant_type: DEVICE_GRANT_TYPE,
      device_code: deviceCode,
      client_id: input.clientId,
    });
    if (input.clientSecret) {
      tokenParams.set("client_secret", input.clientSecret);
    }

    const tokenResponse = await fetchImpl(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const tokenBody = await readJsonBodyAsync(tokenResponse);

    if (tokenResponse.ok) {
      const token = TokenResponseSchema.safeParse(tokenBody);
      if (!token.success) {
        throw new Error("Token endpoint returned an invalid response.");
      }
      const scopes = grantedOAuthScopes(token.data.scope);
      assertGrantedScopesMatchRequest(scopes, input.scopes);
      return {
        access_token: token.data.access_token,
        refresh_token: token.data.refresh_token,
        expires_in: token.data.expires_in,
        created_at: now(),
        token_type: token.data.token_type ?? "Bearer",
        ...(scopes === undefined ? {} : { scopes }),
      };
    }

    const tokenError = DeviceTokenErrorSchema.safeParse(tokenBody);
    const errorCode = tokenError.success ? tokenError.data.error : undefined;

    if (errorCode === "authorization_pending") {
      await sleepAsync(intervalSeconds * 1000);
      continue;
    }

    if (errorCode === "slow_down") {
      intervalSeconds += SLOW_DOWN_INCREMENT_SECONDS;
      await sleepAsync(intervalSeconds * 1000);
      continue;
    }

    if (errorCode === "expired_token") {
      throw new Error("Device code expired before authorization completed. Run `auth` again.");
    }

    if (errorCode === "access_denied") {
      throw new Error("Authorization was denied in the browser.");
    }

    if (tokenError.success) {
      throw new Error(
        `Device token request failed: ${formatOauthError(
          tokenError.data.error,
          tokenError.data.error_description
        )}`
      );
    }

    throw new Error(`Device token request failed (HTTP ${tokenResponse.status}).`);
  }

  throw new Error("Device code expired before authorization completed. Run `auth` again.");
}
