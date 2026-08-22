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
});

export interface DeviceFlowTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  created_at: number;
  token_type: string;
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
      return {
        access_token: token.data.access_token,
        refresh_token: token.data.refresh_token,
        expires_in: token.data.expires_in,
        created_at: now(),
        token_type: token.data.token_type ?? "Bearer",
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
