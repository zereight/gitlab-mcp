import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as http from "http";
import * as net from "net";
import * as url from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import open from "open";
import pkceChallenge from "pkce-challenge";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("gitlab-mcp-oauth");

const execFileAsync = promisify(execFile);

function escapeHtml(str: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str).replace(/[&<>"']/g, c => map[c] || c);
}

// Track pending auth requests across multiple MCP instances
const pendingAuthRequests = new Map<
  string,
  {
    resolve: (tokenData: TokenData) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  created_at: number;
  token_type: string;
}

interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  gitlabUrl: string;
  scopes: string[];
  tokenStoragePath?: string;
  tokenScript?: string;
}

/**
 * Check if a port is already in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(false);
    });

    server.listen(port, "127.0.0.1");
  });
}

/**
 * Request authentication from an existing OAuth server
 */
async function requestAuthFromExistingServer(port: number, requestId: string): Promise<TokenData> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: port,
      path: `/auth-request?requestId=${requestId}`,
      method: "GET",
    };

    const req = http.request(options, res => {
      let data = "";

      res.on("data", chunk => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const tokenData = JSON.parse(data) as TokenData;
            resolve(tokenData);
          } catch (error) {
            reject(new Error(`Failed to parse token data: ${error}`));
          }
        } else {
          reject(new Error(`Auth request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", error => {
      reject(new Error(`Failed to connect to existing OAuth server: ${error.message}`));
    });

    req.setTimeout(5 * 60 * 1000, () => {
      req.destroy();
      reject(new Error("Auth request timed out"));
    });

    req.end();
  });
}

export class GitLabOAuth {
  private config: OAuthConfig;
  private tokenStoragePath: string;
  private codeVerifier?: string;
  private codeChallenge?: string;

  constructor(config: OAuthConfig) {
    this.config = config;
    this.tokenStoragePath =
      config.tokenStoragePath || path.join(os.homedir(), ".gitlab-mcp-token.json");
  }

  /**
   * Get the authorization URL for OAuth flow
   */
  private async getAuthorizationUrl(state: string): Promise<string> {
    const challenge = await pkceChallenge();
    this.codeVerifier = challenge.code_verifier;
    this.codeChallenge = challenge.code_challenge;

    const params = new URLSearchParams();
    params.append("client_id", this.config.clientId);
    params.append("redirect_uri", this.config.redirectUri);
    params.append("response_type", "code");
    params.append("state", state);
    params.append("scope", this.config.scopes.join(" "));
    if (this.codeChallenge) {
      params.append("code_challenge", this.codeChallenge);
      params.append("code_challenge_method", "S256");
    }

    return `${this.config.gitlabUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<TokenData> {
    if (!this.codeVerifier) {
      throw new Error("Code verifier not found. Authorization flow not started.");
    }

    const tokenUrl = `${this.config.gitlabUrl}/oauth/token`;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
      code_verifier: this.codeVerifier,
    });

    // Add client_secret for Confidential applications
    if (this.config.clientSecret) {
      params.append("client_secret", this.config.clientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      created_at: Date.now(),
      token_type: data.token_type,
    };
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<TokenData> {
    const tokenUrl = `${this.config.gitlabUrl}/oauth/token`;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      redirect_uri: this.config.redirectUri,
    });

    // Add client_secret for Confidential applications
    if (this.config.clientSecret) {
      params.append("client_secret", this.config.clientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in,
      created_at: Date.now(),
      token_type: data.token_type,
    };
  }

  /**
   * Save token data to storage
   */
  private saveToken(tokenData: TokenData): void {
    try {
      fs.writeFileSync(
        this.tokenStoragePath,
        JSON.stringify(tokenData, null, 2),
        { mode: 0o600 } // Restrict access to owner only
      );
      logger.info(`Token saved to ${this.tokenStoragePath}`);
    } catch (error) {
      logger.error({ err: error }, "Failed to save token");
      throw error;
    }
  }

  /**
   * Load token data from storage
   */
  private loadToken(): TokenData | null {
    try {
      if (!fs.existsSync(this.tokenStoragePath)) {
        return null;
      }

      const data = fs.readFileSync(this.tokenStoragePath, "utf8");
      return JSON.parse(data) as TokenData;
    } catch (error) {
      logger.error({ err: error }, "Failed to load token");
      return null;
    }
  }

  /**
   * Check if the token is expired
   */
  private isTokenExpired(tokenData: TokenData): boolean {
    if (!tokenData.expires_in) {
      return false; // If no expiry, assume it's still valid
    }

    const expiryTime = tokenData.created_at + tokenData.expires_in * 1000;
    // Add 5 minute buffer to refresh before actual expiry
    return Date.now() >= expiryTime - 5 * 60 * 1000;
  }

  /**
   * Start OAuth flow and wait for callback
   * Uses a shared server if port is already in use
   */
  private async startOAuthFlow(): Promise<TokenData> {
    const callbackPort = parseInt(new URL(this.config.redirectUri).port || "8888");
    const requestId = crypto.randomUUID();

    // Check if port is already in use
    const portInUse = await isPortInUse(callbackPort);

    if (portInUse) {
      // Port is in use, try to connect to existing server
      logger.info(`Port ${callbackPort} is already in use. Connecting to existing OAuth server...`);
      try {
        return await requestAuthFromExistingServer(callbackPort, requestId);
      } catch (error) {
        logger.error({ err: error }, "Failed to connect to existing OAuth server");
        throw new Error(
          `Port ${callbackPort} is in use but cannot connect to existing OAuth server. Please close other instances or use a different port.`
        );
      }
    }

    // Port is free, start the shared OAuth server
    return this.startSharedOAuthServer(callbackPort, requestId);
  }

  /**
   * Start a shared OAuth server that can handle multiple authentication requests
   */
  private async startSharedOAuthServer(
    callbackPort: number,
    initialRequestId: string
  ): Promise<TokenData> {
    const stateToRequestId = new Map<string, string>();
    const requestIdToOAuthInstance = new Map<string, GitLabOAuth>();

    return new Promise((resolve, reject) => {
      // Create initial request
      const state = crypto.randomUUID();
      stateToRequestId.set(state, initialRequestId);
      requestIdToOAuthInstance.set(initialRequestId, this);

      const timeout = setTimeout(
        () => {
          pendingAuthRequests.get(initialRequestId)?.reject(new Error("OAuth flow timed out"));
          pendingAuthRequests.delete(initialRequestId);
        },
        5 * 60 * 1000
      );

      pendingAuthRequests.set(initialRequestId, { resolve, reject, timeout });

      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url || "", true);

          // Handle auth requests from other MCP instances
          if (parsedUrl.pathname === "/auth-request") {
            const newRequestId = parsedUrl.query.requestId as string;
            if (!newRequestId) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Missing requestId parameter");
              return;
            }

            logger.info(`Received auth request from another instance: ${newRequestId}`);

            // Create a new OAuth flow for this request
            const newState = crypto.randomUUID();
            stateToRequestId.set(newState, newRequestId);

            // Store a reference to use the same OAuth config
            requestIdToOAuthInstance.set(newRequestId, this);

            // Open browser for this new request
            const authUrl = await this.getAuthorizationUrl(newState);
            logger.info("Opening browser for new authentication request...");
            logger.info(`If browser doesn't open, visit: ${authUrl}`);
            open(authUrl).catch(err => {
              logger.error({ err }, "Failed to open browser");
              logger.info(`Please manually open: ${authUrl}`);
            });

            // Wait for the auth to complete
            const authPromise = new Promise<TokenData>((authResolve, authReject) => {
              const authTimeout = setTimeout(
                () => {
                  authReject(new Error("OAuth flow timed out"));
                  pendingAuthRequests.delete(newRequestId);
                },
                5 * 60 * 1000
              );

              pendingAuthRequests.set(newRequestId, {
                resolve: authResolve,
                reject: authReject,
                timeout: authTimeout,
              });
            });

            try {
              const tokenData = await authPromise;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(tokenData));
            } catch (error) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end(`Authentication failed: ${error}`);
            }

            return;
          }

          // Handle OAuth callback
          if (parsedUrl.pathname === "/callback") {
            const { code, state: returnedState, error } = parsedUrl.query;

            if (error) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Failed</h1>
                    <p>Error: ${escapeHtml(String(error))}</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              // Find and reject the corresponding request
              const reqId = stateToRequestId.get(returnedState as string);
              if (reqId) {
                const pending = pendingAuthRequests.get(reqId);
                if (pending) {
                  clearTimeout(pending.timeout);
                  pending.reject(new Error(`OAuth error: ${error}`));
                  pendingAuthRequests.delete(reqId);
                }
              }
              return;
            }

            if (!returnedState || typeof returnedState !== "string") {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Failed</h1>
                    <p>Invalid state parameter</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              return;
            }

            const reqId = stateToRequestId.get(returnedState);
            if (!reqId) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Failed</h1>
                    <p>Unknown state parameter</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              return;
            }

            if (!code || typeof code !== "string") {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Failed</h1>
                    <p>No authorization code received</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              const pending = pendingAuthRequests.get(reqId);
              if (pending) {
                clearTimeout(pending.timeout);
                pending.reject(new Error("No authorization code received"));
                pendingAuthRequests.delete(reqId);
              }
              return;
            }

            try {
              const oauthInstance = requestIdToOAuthInstance.get(reqId) || this;
              const tokenData = await oauthInstance.exchangeCodeForToken(code);
              oauthInstance.saveToken(tokenData);

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to the terminal.</p>
                  </body>
                </html>
              `);

              const pending = pendingAuthRequests.get(reqId);
              if (pending) {
                clearTimeout(pending.timeout);
                pending.resolve(tokenData);
                pendingAuthRequests.delete(reqId);
              }
              stateToRequestId.delete(returnedState);
              requestIdToOAuthInstance.delete(reqId);
            } catch (error) {
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body>
                    <h1>Authentication Failed</h1>
                    <p>Failed to exchange code for token</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `);
              const pending = pendingAuthRequests.get(reqId);
              if (pending) {
                clearTimeout(pending.timeout);
                pending.reject(error as Error);
                pendingAuthRequests.delete(reqId);
              }
            }
          } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
          }
        } catch (error) {
          logger.error({ err: error }, "Error handling request");
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        }
      });

      server.listen(callbackPort, "127.0.0.1", async () => {
        logger.info(`Shared OAuth callback server listening on port ${callbackPort}`);
        const authUrl = await this.getAuthorizationUrl(state);
        logger.info("Opening browser for authentication...");
        logger.info(`If browser doesn't open, visit: ${authUrl}`);
        open(authUrl).catch(err => {
          logger.error({ err }, "Failed to open browser");
          logger.info(`Please manually open: ${authUrl}`);
        });
      });

      server.on("error", error => {
        logger.error({ err: error }, "OAuth server error");
        const pending = pendingAuthRequests.get(initialRequestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(error);
          pendingAuthRequests.delete(initialRequestId);
        }
      });
    });
  }

  /**
   * Get an access token from an external command.
   */
  private async getScriptToken(): Promise<TokenData> {
    if (!this.config.tokenScript) {
      throw new Error("OAuth token script is not configured");
    }

    const shell = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "/bin/sh";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", this.config.tokenScript]
      : ["-c", this.config.tokenScript];
    const timeoutSeconds = Number.parseInt(process.env.GITLAB_OAUTH_TOKEN_SCRIPT_TIMEOUT_SECONDS || "30", 10);
    const timeoutMs = (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : 30) * 1000;
    const { stdout } = await execFileAsync(shell, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    const output = stdout.trim();

    if (!output) {
      throw new Error("OAuth token script produced no output");
    }

    let accessToken = output;
    try {
      const parsed = JSON.parse(output) as unknown;
      if (typeof parsed === "string") {
        accessToken = parsed;
      } else if (parsed && typeof parsed === "object") {
        const value = (parsed as { access_token?: unknown; token?: unknown }).access_token ??
          (parsed as { token?: unknown }).token;
        if (typeof value !== "string") {
          throw new Error("OAuth token script JSON must include a string access_token or token field");
        }
        accessToken = value;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OAuth token script JSON")) {
        throw error;
      }
      // Plain-token stdout is the common case.
    }

    if (!accessToken.trim()) {
      throw new Error("OAuth token script returned an empty token");
    }

    return {
      access_token: accessToken.trim(),
      created_at: Date.now(),
      token_type: "Bearer",
    };
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(force = false): Promise<string> {
    if (this.config.tokenScript) {
      return (await this.getScriptToken()).access_token;
    }

    let tokenData = this.loadToken();

    // If no token or expired (or forced), start OAuth flow or refresh
    if (!tokenData) {
      logger.info("No stored token found. Starting OAuth flow...");
      tokenData = await this.startOAuthFlow();
    } else if (force || this.isTokenExpired(tokenData)) {
      logger.info(force && !this.isTokenExpired(tokenData) ? "Force-refreshing OAuth token..." : "Token expired. Refreshing...");
      if (tokenData.refresh_token) {
        try {
          tokenData = await this.refreshAccessToken(tokenData.refresh_token);
          this.saveToken(tokenData);
        } catch (error) {
          logger.error({ err: error }, "Token refresh failed. Starting new OAuth flow...");
          tokenData = await this.startOAuthFlow();
        }
      } else {
        logger.info("No refresh token available. Starting new OAuth flow...");
        tokenData = await this.startOAuthFlow();
      }
    }

    return tokenData.access_token;
  }

  /**
   * Clear stored token
   */
  clearToken(): void {
    try {
      if (fs.existsSync(this.tokenStoragePath)) {
        fs.unlinkSync(this.tokenStoragePath);
        logger.info("Token cleared");
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to clear token");
    }
  }

  /**
   * Check if a valid token exists
   */
  hasValidToken(): boolean {
    if (this.config.tokenScript) {
      return true;
    }

    const tokenData = this.loadToken();
    if (!tokenData) {
      return false;
    }
    return !this.isTokenExpired(tokenData);
  }
}

/**
 * Create and initialize a GitLabOAuth client.
 * Performs initial authentication (triggers browser flow if needed).
 * Returns the client instance and the initial access token.
 */
export async function initializeOAuthClient(gitlabUrl: string = "https://gitlab.com"): Promise<{ client: GitLabOAuth; accessToken: string }> {
  const clientId = process.env.GITLAB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI || "http://127.0.0.1:8888/callback";
  const tokenStoragePath = process.env.GITLAB_OAUTH_TOKEN_PATH;
  const tokenScript = process.env.GITLAB_OAUTH_TOKEN_SCRIPT;

  if (!clientId && !tokenScript) {
    throw new Error(
      "GITLAB_OAUTH_CLIENT_ID or GITLAB_OAUTH_TOKEN_SCRIPT environment variable is required for OAuth authentication"
    );
  }

  const oauth = new GitLabOAuth({
    clientId: clientId || "external-token-script",
    clientSecret,
    redirectUri,
    gitlabUrl,
    scopes: [process.env.GITLAB_READ_ONLY_MODE === "true" ? "read_api" : "api"],
    tokenStoragePath,
    tokenScript,
  });

  // Single call: triggers browser flow if needed, or reads cached token
  const accessToken = await oauth.getAccessToken();

  return { client: oauth, accessToken };
}

/**
 * Initialize OAuth authentication for GitLab MCP server
 */
export async function initializeOAuth(gitlabUrl: string = "https://gitlab.com"): Promise<string> {
  const { accessToken } = await initializeOAuthClient(gitlabUrl);
  return accessToken;
}
