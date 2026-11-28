import { timingSafeEqual } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitLabClientPool } from "../gitlab-client-pool.js";
import type { FetchFn } from "../auth-retry.js";
import type { StatelessKeyMaterial } from "../stateless/index.js";

/**
 * Values and functions owned by index.ts that the transport start functions use.
 * index.ts builds one of these in initializeServerByTransportMode(); the transport
 * modules never import index.ts.
 *
 * getFetch is a getter because auth/session-store reassigns its fetch when the cookie
 * file changes, so the current value must be read at each call.
 */
export interface TransportDeps {
  createServer: () => McpServer;
  logger: Logger;
  clientPool: GitLabClientPool;
  GITLAB_API_URL: string;
  STREAMABLE_HTTP_AUTH_TOKEN: string | undefined;
  STATELESS_MATERIAL: StatelessKeyMaterial | null;
  requireMcpHostAndOrigin: (req: Request, res: Response, next: NextFunction) => void;
  hasStatelessSessionId: (req: {
    headers: Record<string, string | string[] | undefined>;
  }) => boolean;
  getFetch: () => FetchFn;
  registerDownloadProxyRoutes: (app: Express) => void;
  resolveTrustedGitLabApiUrl: (value: string) => string;
}

/**
 *  Color constants for terminal output
 */
export const colorGreen = "\x1b[32m";
export const colorReset = "\x1b[0m";

export function isConstantTimeSecretMatch(
  provided: string | undefined,
  expected: string | undefined
): boolean {
  if (!provided || !expected || provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
