#!/usr/bin/env node

// Parse CLI arguments
const args = process.argv.slice(2);
const cliArgs: Record<string, string> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    if (value) {
      cliArgs[key] = value;
    } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
      cliArgs[key] = args[++i];
    }
  }
}

// Helper function to get config value (CLI args take precedence over env vars)
function getConfig(cliKey: string, envKey: string): string | undefined;
function getConfig(cliKey: string, envKey: string, defaultValue: string): string;
function getConfig(cliKey: string, envKey: string, defaultValue?: string): string | undefined {
  return cliArgs[cliKey] || process.env[envKey] || defaultValue;
}

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AsyncLocalStorage } from "node:async_hooks";
import express, { Request, Response } from "express";
import fetchCookie from "fetch-cookie";
import fs from "node:fs";
import os from "node:os";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import nodeFetch from "node-fetch";
import path, { dirname } from "node:path";
import { SocksProxyAgent } from "socks-proxy-agent";
import { CookieJar, parse as parseCookie } from "tough-cookie";
import { fileURLToPath, URL } from "node:url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { initializeOAuth } from "./oauth.js";
import { GitLabClientPool } from "./gitlab-client-pool.js";
// Add type imports for proxy agents
import { Agent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import {
  BulkPublishDraftNotesSchema,
  CancelPipelineJobSchema,
  CancelPipelineSchema,
  CreateBranchOptionsSchema,
  CreateBranchSchema,
  CreateDraftNoteSchema,
  CreateIssueLinkSchema,
  CreateIssueNoteSchema,
  CreateIssueOptionsSchema,
  CreateIssueSchema,
  CreateLabelSchema, // Added
  CreateMergeRequestNoteSchema,
  CreateMergeRequestDiscussionNoteSchema,
  CreateMergeRequestOptionsSchema,
  CreateMergeRequestSchema,
  CreateMergeRequestThreadSchema,
  CreateNoteSchema,
  CreateOrUpdateFileSchema,
  CreatePipelineSchema,
  CreateProjectMilestoneSchema,
  CreateRepositoryOptionsSchema,
  CreateRepositorySchema,
  CreateWikiPageSchema,
  DeleteDraftNoteSchema,
  DeleteIssueLinkSchema,
  DeleteIssueSchema,
  DeleteLabelSchema,
  DeleteProjectMilestoneSchema,
  DeleteWikiPageSchema,
  DeleteMergeRequestNoteSchema,
  EditProjectMilestoneSchema,
  type FileOperation,
  ForkRepositorySchema,
  GetBranchDiffsSchema,
  GetCommitDiffSchema,
  GetCommitSchema,
  GetDraftNoteSchema,
  GetFileContentsSchema,
  GetIssueLinkSchema,
  GetIssueSchema,
  GetLabelSchema,
  GetMergeRequestDiffsSchema,
  GetMergeRequestSchema,
  GetMilestoneBurndownEventsSchema,
  GetMilestoneIssuesSchema,
  GetMilestoneMergeRequestsSchema,
  GetNamespaceSchema,
  // pipeline job schemas
  GetPipelineJobOutputSchema,
  GetPipelineSchema,
  GetProjectMilestoneSchema,
  GetProjectSchema,
  type GetRepositoryTreeOptions,
  GetRepositoryTreeSchema,
  GetUsersSchema,
  GetWikiPageSchema,
  type GitLabCommit,
  GitLabCommitSchema,
  GitLabCompareResult,
  GitLabCompareResultSchema,
  type GitLabContent,
  GitLabContentSchema,
  type GitLabCreateUpdateFileResponse,
  GitLabCreateUpdateFileResponseSchema,
  GitLabDiffSchema,
  type GitLabDiscussion,
  // Discussion Types
  type GitLabDiscussionNote,
  // Discussion Schemas
  GitLabDiscussionNoteSchema, // Added
  GitLabDiscussionSchema,
  // Draft Notes Types
  type GitLabDraftNote,
  // Draft Notes Schemas
  GitLabDraftNoteSchema,
  type GitLabFork,
  GitLabForkSchema,
  type GitLabIssue,
  type GitLabIssueLink,
  GitLabIssueLinkSchema,
  GitLabIssueSchema,
  type GitLabIssueWithLinkDetails,
  GitLabIssueWithLinkDetailsSchema,
  type GitLabLabel,
  GitLabMarkdownUpload,
  GitLabMarkdownUploadSchema,
  type GitLabMergeRequest,
  type GitLabMergeRequestDiff,
  GitLabMergeRequestSchema,
  type GitLabMilestones,
  GitLabMilestonesSchema,
  type GitLabNamespace,
  type GitLabNamespaceExistsResponse,
  GitLabNamespaceExistsResponseSchema,
  GitLabNamespaceSchema,
  type GitLabPipeline,
  type GitLabPipelineJob,
  GitLabPipelineJobSchema,
  GitLabPipelineSchema,
  type GitLabPipelineTriggerJob,
  GitLabPipelineTriggerJobSchema,
  type GitLabProject,
  type GitLabProjectMember,
  GitLabProjectMemberSchema,
  GitLabProjectSchema,
  type GitLabReference,
  GitLabReferenceSchema,
  type GitLabRepository,
  GitLabRepositorySchema,
  type GitLabSearchResponse,
  GitLabSearchResponseSchema,
  type GitLabTree,
  type GitLabTreeItem,
  GitLabTreeItemSchema,
  GitLabTreeSchema,
  type GitLabUser,
  GitLabUserSchema,
  type GitLabUsersResponse,
  GitLabUsersResponseSchema,
  type GitLabWikiPage,
  GitLabWikiPageSchema,
  GroupIteration,
  type ListCommitsOptions,
  ListCommitsSchema,
  ListDraftNotesSchema,
  ListGroupIterationsSchema,
  ListGroupProjectsSchema,
  ListIssueDiscussionsSchema,
  ListIssueLinksSchema,
  ListIssuesSchema,
  ListLabelsSchema,
  ListMergeRequestDiffsSchema, // Added
  ListMergeRequestDiscussionsSchema,
  ListMergeRequestsSchema,
  ListMergeRequestVersionsSchema,
  GetMergeRequestVersionSchema,
  GitLabMergeRequestVersionSchema,
  GitLabMergeRequestVersionDetailSchema,
  type GitLabMergeRequestVersion,
  type GitLabMergeRequestVersionDetail,
  ListNamespacesSchema,
  type ListPipelineJobsOptions,
  ListPipelineJobsSchema,
  type ListPipelinesOptions,
  ListPipelinesSchema,
  type ListPipelineTriggerJobsOptions,
  ListPipelineTriggerJobsSchema,
  type ListProjectMembersOptions,
  ListProjectMembersSchema,
  ListProjectMilestonesSchema,
  ListProjectsSchema,
  ListWikiPagesOptions,
  ListWikiPagesSchema,
  MarkdownUploadSchema,
  DownloadAttachmentSchema,
  MergeMergeRequestSchema,
  ApproveMergeRequestSchema,
  UnapproveMergeRequestSchema,
  GetMergeRequestApprovalStateSchema,
  GitLabMergeRequestApprovalStateSchema,
  type GitLabMergeRequestApprovalState,
  type MergeRequestThreadPosition,
  type MergeRequestThreadPositionCreate,
  type MyIssuesOptions,
  MyIssuesSchema,
  type PaginatedDiscussionsResponse,
  PaginatedDiscussionsResponseSchema,
  type PaginationOptions,
  PromoteProjectMilestoneSchema,
  PublishDraftNoteSchema,
  PlayPipelineJobSchema,
  PushFilesSchema,
  RetryPipelineJobSchema,
  RetryPipelineSchema,
  SearchRepositoriesSchema,
  UpdateDraftNoteSchema,
  UpdateIssueNoteSchema,
  UpdateIssueSchema,
  UpdateLabelSchema,
  UpdateMergeRequestNoteSchema,
  UpdateMergeRequestDiscussionNoteSchema,
  UpdateMergeRequestSchema,
  UpdateWikiPageSchema,
  VerifyNamespaceSchema,
  GitLabEventSchema,
  ListEventsSchema,
  GetProjectEventsSchema,
  GitLabEvent,
  ExecuteGraphQLSchema,
  type GitLabRelease,
  GitLabReleaseSchema,
  ListReleasesSchema,
  GetReleaseSchema,
  CreateReleaseSchema,
  UpdateReleaseSchema,
  DeleteReleaseSchema,
  CreateReleaseEvidenceSchema,
  DownloadReleaseAssetSchema,
  GetMergeRequestNotesSchema,
  GetMergeRequestNoteSchema,
  DeleteMergeRequestDiscussionNoteSchema,
  ResolveMergeRequestThreadSchema,
} from "./schemas.js";

import { randomUUID } from "node:crypto";
import { pino } from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      destination: 2,
    },
  },
});

/**
 * Available transport modes for MCP server
 */
enum TransportMode {
  STDIO = "stdio",
  SSE = "sse",
  STREAMABLE_HTTP = "streamable-http",
}

/**
 * Read version from package.json
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
let SERVER_VERSION = "unknown";
try {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    SERVER_VERSION = packageJson.version || SERVER_VERSION;
  }
} catch {
  // Intentionally ignored: version read failure is non-critical
}

/**
 * Create a new MCP Server instance with request handlers registered.
 * Each transport connection gets its own Server instance to prevent
 * cross-client data leakage (GHSA-345p-7cg4-v4c7).
 */
function createServer(): Server {
  const serverInstance = new Server(
    {
      name: "better-gitlab-mcp-server",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  serverInstance.setRequestHandler(ListToolsRequestSchema, async () => {
    // Step 1: Toolset filter — keep tools in enabled toolsets
    const toolsAfterToolsets = allTools.filter(tool =>
      isToolInEnabledToolset(tool.name, enabledToolsets)
    );

    // Step 2: Add GITLAB_TOOLS (individual tools bypass toolset filter)
    const toolsetToolNames = new Set(toolsAfterToolsets.map(t => t.name));
    const toolsAfterIndividual = [
      ...toolsAfterToolsets,
      ...allTools.filter(
        tool => individuallyEnabledTools.has(tool.name) && !toolsetToolNames.has(tool.name)
      ),
    ];

    // Step 3: Add legacy flag overrides (USE_PIPELINE, USE_MILESTONE, USE_GITLAB_WIKI)
    const afterIndividualNames = new Set(toolsAfterIndividual.map(t => t.name));
    const toolsAfterLegacy = [
      ...toolsAfterIndividual,
      ...allTools.filter(
        tool => featureFlagOverrides.has(tool.name) && !afterIndividualNames.has(tool.name)
      ),
    ];

    // Step 4: Read-only filter
    const toolsAfterReadOnly = GITLAB_READ_ONLY_MODE
      ? toolsAfterLegacy.filter(tool => readOnlyTools.has(tool.name))
      : toolsAfterLegacy;

    // Step 5: Regex denial filter
    const toolsAfterDenied = GITLAB_DENIED_TOOLS_REGEX
      ? toolsAfterReadOnly.filter(tool => !GITLAB_DENIED_TOOLS_REGEX!.test(tool.name))
      : toolsAfterReadOnly;

    // Step 6: Gemini $schema cleanup
    // <<< START: Gemini 호환성을 위해 $schema 제거 >>>
    const tools = toolsAfterDenied.map(tool => {
      // inputSchema가 존재하고 객체인지 확인
      if (tool.inputSchema && typeof tool.inputSchema === "object" && tool.inputSchema !== null) {
        // $schema 키가 존재하면 삭제
        if ("$schema" in tool.inputSchema) {
          // 불변성을 위해 새로운 객체 생성 (선택적이지만 권장)
          const modifiedSchema = { ...tool.inputSchema };
          delete modifiedSchema.$schema;
          return { ...tool, inputSchema: modifiedSchema };
        }
      }
      // 변경이 필요 없으면 그대로 반환
      return tool;
    });
    // <<< END: Gemini 호환성을 위해 $schema 제거 >>>

    return {
      tools, // $schema가 제거된 도구 목록 반환
    };
  });

  serverInstance.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    // Manually retrieve the session context using the session ID passed in the request.
    // This is a robust workaround for AsyncLocalStorage context loss.
    const sessionId = request.params.sessionId;
    if (REMOTE_AUTHORIZATION && sessionId && authBySession[sessionId]) {
      const authData = authBySession[sessionId];
      const sessionContext: SessionAuth = {
        sessionId,
        header: authData.header,
        token: authData.token,
        lastUsed: authData.lastUsed,
        apiUrl: authData.apiUrl,
      };
      // Run the handler within the retrieved context
      return await sessionAuthStore.run(sessionContext, () => handleToolCall(request.params));
    }
    // Fallback for non-remote-auth mode or if session is not found
    return handleToolCall(request.params);
  });

  return serverInstance;
}

/**
 * Validate configuration at startup
 */
function validateConfiguration(): void {
  const errors: string[] = [];

  // Validate SESSION_TIMEOUT_SECONDS
  const timeoutStr = process.env.SESSION_TIMEOUT_SECONDS;
  if (timeoutStr) {
    const timeout = Number.parseInt(timeoutStr, 10);
    // Allow values >=1 for testing purposes, but recommend 60-86400 for production
    if (Number.isNaN(timeout) || timeout < 1 || timeout > 86400) {
      errors.push(
        `SESSION_TIMEOUT_SECONDS must be between 1 and 86400 seconds, got: ${timeoutStr}`
      );
    }
    if (timeout < 60) {
      logger.warn(
        `SESSION_TIMEOUT_SECONDS=${timeout} is below recommended minimum of 60 seconds. Only use low values for testing.`
      );
    }
  }

  // Validate MAX_SESSIONS
  const maxSessionsStr = process.env.MAX_SESSIONS;
  if (maxSessionsStr) {
    const maxSessions = Number.parseInt(maxSessionsStr, 10);
    if (Number.isNaN(maxSessions) || maxSessions < 1 || maxSessions > 10000) {
      errors.push(`MAX_SESSIONS must be between 1 and 10000, got: ${maxSessionsStr}`);
    }
  }

  // Validate MAX_REQUESTS_PER_MINUTE
  const maxReqStr = process.env.MAX_REQUESTS_PER_MINUTE;
  if (maxReqStr) {
    const maxReq = Number.parseInt(maxReqStr, 10);
    if (Number.isNaN(maxReq) || maxReq < 1 || maxReq > 1000) {
      errors.push(`MAX_REQUESTS_PER_MINUTE must be between 1 and 1000, got: ${maxReqStr}`);
    }
  }

  // Validate PORT
  const portStr = getConfig("port", "PORT");
  if (portStr) {
    const port = Number.parseInt(portStr, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be between 1 and 65535, got: ${portStr}`);
    }
  }

  // Validate GITLAB_API_URL format
  const apiUrls = getConfig("api-url", "GITLAB_API_URL")?.split(",") || [];
  if (apiUrls.length > 0) {
    for (const url of apiUrls) {
      try {
        new URL(url.trim());
      } catch {
        errors.push(`GITLAB_API_URL contains an invalid URL: ${url.trim()}`);
      }
    }
  }

  // Validate auth configuration
  const remoteAuth = getConfig("remote-auth", "REMOTE_AUTHORIZATION") === "true";
  const useOAuth = getConfig("use-oauth", "GITLAB_USE_OAUTH") === "true";
  const hasToken = !!getConfig("token", "GITLAB_PERSONAL_ACCESS_TOKEN");
  const hasCookie = !!getConfig("cookie-path", "GITLAB_AUTH_COOKIE_PATH");

  if (!remoteAuth && !useOAuth && !hasToken && !hasCookie) {
    errors.push(
      "Either --token, --cookie-path, --use-oauth=true, or --remote-auth=true must be set (or use environment variables)"
    );
  }

  const enableDynamicApiUrl =
    getConfig("enable-dynamic-api-url", "ENABLE_DYNAMIC_API_URL") === "true";
  if (enableDynamicApiUrl && !remoteAuth) {
    errors.push("ENABLE_DYNAMIC_API_URL=true requires REMOTE_AUTHORIZATION=true");
  }

  if (errors.length > 0) {
    logger.error("Configuration validation failed:");
    errors.forEach(err => logger.error(`  - ${err}`));
    process.exit(1);
  }

  logger.info("Configuration validation passed");
}

const GITLAB_PERSONAL_ACCESS_TOKEN = getConfig("token", "GITLAB_PERSONAL_ACCESS_TOKEN");
let OAUTH_ACCESS_TOKEN: string | null = null;
const GITLAB_AUTH_COOKIE_PATH = getConfig("cookie-path", "GITLAB_AUTH_COOKIE_PATH");
const USE_OAUTH = getConfig("use-oauth", "GITLAB_USE_OAUTH") === "true";
const IS_OLD = getConfig("is-old", "GITLAB_IS_OLD") === "true";
const GITLAB_READ_ONLY_MODE = getConfig("read-only", "GITLAB_READ_ONLY_MODE") === "true";
const GITLAB_DENIED_TOOLS_REGEX = (() => {
  const pattern = getConfig("denied-tools-regex", "GITLAB_DENIED_TOOLS_REGEX");
  if (!pattern) return undefined;

  // Reject patterns that are too long (potential ReDoS vector)
  const MAX_PATTERN_LENGTH = 200;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    logger.error(
      `GITLAB_DENIED_TOOLS_REGEX pattern exceeds ${MAX_PATTERN_LENGTH} chars. Ignoring.`
    );
    return undefined;
  }

  // Reject patterns with nested quantifiers that can cause catastrophic backtracking (ReDoS)
  // e.g., (a+)+, (a*)+, (a+)*, (a{1,})+
  const NESTED_QUANTIFIER_PATTERN = /(\(.*[+*?].*\)|\[.*\])[+*?]|\(\?[^:)]/;
  if (NESTED_QUANTIFIER_PATTERN.test(pattern)) {
    logger.error(
      `GITLAB_DENIED_TOOLS_REGEX contains potentially unsafe nested quantifiers. Ignoring.`
    );
    return undefined;
  }

  try {
    const regex = new RegExp(pattern);
    // Dry-run against a sample string to catch immediate issues
    regex.test("sample_tool_name");
    return regex;
  } catch {
    logger.error(`Invalid GITLAB_DENIED_TOOLS_REGEX pattern: "${pattern}". Ignoring.`);
    return undefined;
  }
})();
const USE_GITLAB_WIKI = getConfig("use-wiki", "USE_GITLAB_WIKI") === "true";
const USE_MILESTONE = getConfig("use-milestone", "USE_MILESTONE") === "true";
const USE_PIPELINE = getConfig("use-pipeline", "USE_PIPELINE") === "true";
const GITLAB_TOOLSETS_RAW = getConfig("toolsets", "GITLAB_TOOLSETS");
const GITLAB_TOOLS_RAW = getConfig("tools", "GITLAB_TOOLS");
const SSE = getConfig("sse", "SSE") === "true";
const STREAMABLE_HTTP = getConfig("streamable-http", "STREAMABLE_HTTP") === "true";
const REMOTE_AUTHORIZATION = getConfig("remote-auth", "REMOTE_AUTHORIZATION") === "true";
const ENABLE_DYNAMIC_API_URL =
  getConfig("enable-dynamic-api-url", "ENABLE_DYNAMIC_API_URL") === "true";
const SESSION_TIMEOUT_SECONDS = Number.parseInt(
  getConfig("session-timeout", "SESSION_TIMEOUT_SECONDS", "3600"),
  10
);
const HOST = getConfig("host", "HOST") || "127.0.0.1";
const PORT = Number.parseInt(getConfig("port", "PORT", "3002"), 10);
// Add proxy configuration
const HTTP_PROXY = getConfig("http-proxy", "HTTP_PROXY");
const HTTPS_PROXY = getConfig("https-proxy", "HTTPS_PROXY");
const NODE_TLS_REJECT_UNAUTHORIZED = getConfig(
  "tls-reject-unauthorized",
  "NODE_TLS_REJECT_UNAUTHORIZED"
);
const GITLAB_CA_CERT_PATH = getConfig("ca-cert-path", "GITLAB_CA_CERT_PATH");
const GITLAB_POOL_MAX_SIZE = getConfig("pool-max-size", "GITLAB_POOL_MAX_SIZE")
  ? Number.parseInt(getConfig("pool-max-size", "GITLAB_POOL_MAX_SIZE")!, 10)
  : 100;

let sslOptions = undefined;
if (NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  sslOptions = { rejectUnauthorized: false };
} else if (GITLAB_CA_CERT_PATH) {
  const ca = fs.readFileSync(GITLAB_CA_CERT_PATH);
  sslOptions = { ca };
}

// Configure proxy agents if proxies are set
let httpAgent: Agent | undefined = undefined;
let httpsAgent: Agent | undefined = undefined;

if (HTTP_PROXY) {
  if (HTTP_PROXY.startsWith("socks")) {
    httpAgent = new SocksProxyAgent(HTTP_PROXY);
  } else {
    httpAgent = new HttpProxyAgent(HTTP_PROXY);
  }
}
if (HTTPS_PROXY) {
  if (HTTPS_PROXY.startsWith("socks")) {
    httpsAgent = new SocksProxyAgent(HTTPS_PROXY);
  } else {
    httpsAgent = new HttpsProxyAgent(HTTPS_PROXY, sslOptions);
  }
}
httpsAgent = httpsAgent || new HttpsAgent(sslOptions);
httpAgent = httpAgent || new Agent();

// Initialize the client pool for managing multiple GitLab instances
const clientPool = new GitLabClientPool({
  apiUrls: (getConfig("api-url", "GITLAB_API_URL") || "https://gitlab.com")
    .split(",")
    .map(normalizeGitLabApiUrl),
  httpProxy: HTTP_PROXY,
  httpsProxy: HTTPS_PROXY,
  rejectUnauthorized: NODE_TLS_REJECT_UNAUTHORIZED !== "0",
  caCertPath: GITLAB_CA_CERT_PATH,
  poolMaxSize: GITLAB_POOL_MAX_SIZE,
});

// Create cookie jar with clean Netscape file parsing
// Resolve cookie path once using os.homedir() for cross-platform support
const resolvedCookiePath = GITLAB_AUTH_COOKIE_PATH
  ? GITLAB_AUTH_COOKIE_PATH.startsWith("~/")
    ? path.join(os.homedir(), GITLAB_AUTH_COOKIE_PATH.slice(2))
    : GITLAB_AUTH_COOKIE_PATH
  : null;

const createCookieJar = async (): Promise<CookieJar | null> => {
  if (!resolvedCookiePath) return null;

  let cookieContent: string;
  try {
    cookieContent = await fs.promises.readFile(resolvedCookiePath, "utf8");
  } catch (error) {
    logger.error({ error, path: resolvedCookiePath }, "Failed to read cookie file");
    return null;
  }

  const jar = new CookieJar();
  for (let line of cookieContent.split("\n")) {
    // Handle #HttpOnly_ prefix
    if (line.startsWith("#HttpOnly_")) {
      line = line.slice(10);
    }
    // Skip comments and empty lines
    if (line.startsWith("#") || !line.trim()) {
      continue;
    }

    // Parse Netscape format: domain, flag, path, secure, expires, name, value
    const parts = line.split("\t");
    if (parts.length >= 7) {
      const [domain, , cookiePath, secure, expires, name, value] = parts;

      // Build cookie string in standard format
      const secureFlag = secure === "TRUE" ? "; Secure" : "";
      const expiresFlag =
        expires === "0"
          ? ""
          : `; Expires=${new Date(Number.parseInt(expires, 10) * 1000).toUTCString()}`;
      const cookieStr = `${name}=${value}; Domain=${domain}; Path=${cookiePath}${secureFlag}${expiresFlag}`;

      // Use tough-cookie's parse function for robust parsing
      const cookie = parseCookie(cookieStr);
      if (cookie) {
        const url = `${secure === "TRUE" ? "https" : "http"}://${domain.startsWith(".") ? domain.slice(1) : domain}`;
        jar.setCookieSync(cookie, url);
      }
    }
  }

  return jar;
};

// Cookie jar and fetch - reloaded when cookie file changes
let cookieJar: CookieJar | null = null;
let fetch: typeof nodeFetch = nodeFetch;
let lastCookieMtime = 0;
let cookieReloadLock: Promise<void> | null = null; // Mutex to prevent parallel reloads
// Auth proxies may redirect and set cookies on the first request. We make a throwaway
// request so subsequent requests have the correct cookies. Reset when cookies reload.
let initialSessionRequestMade = false;

// Cookie jar is loaded on first request via reloadCookiesIfChanged (lastCookieMtime=0 triggers load)

async function reloadCookiesIfChanged(): Promise<void> {
  if (!resolvedCookiePath) return;
  if (cookieReloadLock) return cookieReloadLock;

  cookieReloadLock = (async () => {
    try {
      const mtime = (await fs.promises.stat(resolvedCookiePath)).mtimeMs;
      if (mtime !== lastCookieMtime) {
        logger.info(
          { oldMtime: lastCookieMtime, newMtime: mtime },
          lastCookieMtime === 0 ? "Loading cookie file" : "Cookie file changed, reloading"
        );
        lastCookieMtime = mtime;
        const newJar = await createCookieJar();
        cookieJar = newJar;
        fetch = newJar ? fetchCookie(nodeFetch, newJar) : nodeFetch;
        initialSessionRequestMade = false;
      }
    } catch {
      // File deleted or inaccessible - clear cached cookies
      if (cookieJar) {
        logger.info("Cookie file removed, clearing cached cookies");
        cookieJar = null;
        fetch = nodeFetch;
        lastCookieMtime = 0;
        initialSessionRequestMade = false;
      }
    }
  })();

  try {
    await cookieReloadLock;
  } finally {
    cookieReloadLock = null;
  }
}

async function ensureSessionForRequest(): Promise<void> {
  if (!resolvedCookiePath) return;

  await reloadCookiesIfChanged();

  if (!cookieJar || initialSessionRequestMade) return;

  try {
    const response = await fetch(`${getEffectiveApiUrl()}/user`, {
      ...getFetchConfig(),
      redirect: "follow",
    });
    // 401 means auth failed but the request completed - cookies were still exchanged
    initialSessionRequestMade = response.ok || response.status === 401;
  } catch {
    logger.debug("Session warmup request failed, will retry on next request");
  }
}

// Session auth context for remote authorization
interface SessionAuth {
  sessionId: string;
  header: "Authorization" | "Private-Token";
  token: string;
  lastUsed: number;
  apiUrl: string; // The API URL for the current request
}

interface AuthData {
  header: "Authorization" | "Private-Token";
  token: string;
  lastUsed: number;
  apiUrl: string;
}

const sessionAuthStore = new AsyncLocalStorage<SessionAuth>();

// Session context map for storing auth data by session ID
// This survives async boundaries where AsyncLocalStorage might not
const authBySession: Record<string, AuthData> = {};

// Base headers without authentication
const BASE_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Build authentication headers dynamically based on context
 * In REMOTE_AUTHORIZATION mode, reads from AsyncLocalStorage session context
 * Otherwise, uses environment token
 */
function buildAuthHeaders(): Record<string, string> {
  if (REMOTE_AUTHORIZATION) {
    const ctx = sessionAuthStore.getStore();
    logger.debug({ context: ctx }, "buildAuthHeaders: session context");
    if (ctx?.token) {
      return {
        [ctx.header]: ctx.header === "Authorization" ? `Bearer ${ctx.token}` : ctx.token,
      };
    }
    return {}; // No auth headers if no session context
  }

  // Standard mode: prioritize OAuth token, then fall back to environment token
  const token = OAUTH_ACCESS_TOKEN || GITLAB_PERSONAL_ACCESS_TOKEN;

  if (IS_OLD && token) {
    return { "Private-Token": String(token) };
  }
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Get the effective GitLab API URL for the current request
 * In REMOTE_AUTHORIZATION mode with ENABLE_DYNAMIC_API_URL, reads from session context
 * Otherwise, uses environment GITLAB_API_URL
 */
function getEffectiveApiUrl(): string {
  if (ENABLE_DYNAMIC_API_URL) {
    const ctx = sessionAuthStore.getStore();
    if (ctx?.apiUrl) {
      return ctx.apiUrl;
    }
    logger.warn({ ctx }, "getEffectiveApiUrl: No context or apiUrl found, falling back to default");
  }
  return GITLAB_API_URL;
}

/**
 * Get fetch configuration with proper client from pool
 * Uses connection pooling when dynamic API URLs are enabled
 */

/**
 * Constructs the fetch configuration dynamically.
 * This function is called immediately before each `fetch` to ensure it runs
 * within the correct AsyncLocalStorage context, capturing the necessary auth
 * and API URL information for the current request.
 */
const getFetchConfig = () => {
  const effectiveApiUrl = getEffectiveApiUrl();
  const agent = clientPool.getOrCreateAgentForUrl(effectiveApiUrl);

  return {
    headers: { ...BASE_HEADERS, ...buildAuthHeaders() },
    agent: agent,
  };
};

const toJSONSchema = (schema: z.ZodTypeAny) => {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });

  // Post-process to fix nullable/optional fields that should truly be optional
  function fixNullableOptional(obj: any): any {
    if (obj && typeof obj === "object") {
      // If this object has properties, process them
      if (obj.properties) {
        const requiredSet = new Set<string>(obj.required || []);
        Object.keys(obj.properties).forEach(key => {
          const prop = obj.properties[key];

          // Handle fields that can be null or omitted
          // If a property has type: ["object", "null"] or anyOf with null, it should not be required
          if (prop.anyOf && prop.anyOf.some((t: any) => t.type === "null")) {
            requiredSet.delete(key);
          } else if (Array.isArray(prop.type) && prop.type.includes("null")) {
            requiredSet.delete(key);
          }

          // Recursively process nested objects
          obj.properties[key] = fixNullableOptional(prop);
        });
        // Normalize the required array after processing all properties
        if (requiredSet.size > 0) {
          obj.required = Array.from(requiredSet);
        } else if (Object.prototype.hasOwnProperty.call(obj, "required")) {
          delete obj.required;
        }
      }

      // Process anyOf/allOf/oneOf
      ["anyOf", "allOf", "oneOf"].forEach(combiner => {
        if (obj[combiner]) {
          obj[combiner] = obj[combiner].map(fixNullableOptional);
        }
      });
    }

    return obj;
  }

  return fixNullableOptional(jsonSchema);
};

// Define all available tools
const allTools = [
  {
    name: "merge_merge_request",
    description: "Merge a merge request in a GitLab project",
    inputSchema: toJSONSchema(MergeMergeRequestSchema),
  },
  {
    name: "approve_merge_request",
    description: "Approve a merge request. Requires appropriate permissions.",
    inputSchema: toJSONSchema(ApproveMergeRequestSchema),
  },
  {
    name: "unapprove_merge_request",
    description: "Unapprove a previously approved merge request. Requires appropriate permissions.",
    inputSchema: toJSONSchema(UnapproveMergeRequestSchema),
  },
  {
    name: "get_merge_request_approval_state",
    description:
      "Get the approval state of a merge request including approval rules and who has approved",
    inputSchema: toJSONSchema(GetMergeRequestApprovalStateSchema),
  },
  {
    name: "execute_graphql",
    description: "Execute a GitLab GraphQL query",
    inputSchema: zodToJsonSchema(ExecuteGraphQLSchema),
  },
  {
    name: "create_or_update_file",
    description: "Create or update a single file in a GitLab project",
    inputSchema: toJSONSchema(CreateOrUpdateFileSchema),
  },
  {
    name: "search_repositories",
    description: "Search for GitLab projects",
    inputSchema: toJSONSchema(SearchRepositoriesSchema),
  },
  {
    name: "create_repository",
    description: "Create a new GitLab project",
    inputSchema: toJSONSchema(CreateRepositorySchema),
  },
  {
    name: "get_file_contents",
    description: "Get the contents of a file or directory from a GitLab project",
    inputSchema: toJSONSchema(GetFileContentsSchema),
  },
  {
    name: "push_files",
    description: "Push multiple files to a GitLab project in a single commit",
    inputSchema: toJSONSchema(PushFilesSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a GitLab project",
    inputSchema: toJSONSchema(CreateIssueSchema),
  },
  {
    name: "create_merge_request",
    description: "Create a new merge request in a GitLab project",
    inputSchema: toJSONSchema(CreateMergeRequestSchema),
  },
  {
    name: "fork_repository",
    description: "Fork a GitLab project to your account or specified namespace",
    inputSchema: toJSONSchema(ForkRepositorySchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch in a GitLab project",
    inputSchema: toJSONSchema(CreateBranchSchema),
  },
  {
    name: "get_merge_request",
    description:
      "Get details of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(GetMergeRequestSchema),
  },
  {
    name: "get_merge_request_diffs",
    description:
      "Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(GetMergeRequestDiffsSchema),
  },
  {
    name: "list_merge_request_diffs",
    description:
      "List merge request diffs with pagination support (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(ListMergeRequestDiffsSchema),
  },
  {
    name: "list_merge_request_versions",
    description: "List all versions of a merge request",
    inputSchema: toJSONSchema(ListMergeRequestVersionsSchema),
  },
  {
    name: "get_merge_request_version",
    description: "Get a specific version of a merge request",
    inputSchema: toJSONSchema(GetMergeRequestVersionSchema),
  },
  {
    name: "get_branch_diffs",
    description: "Get the changes/diffs between two branches or commits in a GitLab project",
    inputSchema: toJSONSchema(GetBranchDiffsSchema),
  },
  {
    name: "update_merge_request",
    description: "Update a merge request (Either mergeRequestIid or branchName must be provided)",
    inputSchema: toJSONSchema(UpdateMergeRequestSchema),
  },
  {
    name: "create_note",
    description: "Create a new note (comment) to an issue or merge request",
    inputSchema: toJSONSchema(CreateNoteSchema),
  },
  {
    name: "create_merge_request_thread",
    description: "Create a new thread on a merge request",
    inputSchema: toJSONSchema(CreateMergeRequestThreadSchema),
  },
  {
    name: "resolve_merge_request_thread",
    description: "Resolve a thread on a merge request",
    inputSchema: toJSONSchema(ResolveMergeRequestThreadSchema),
  },
  {
    name: "mr_discussions",
    description: "List discussion items for a merge request",
    inputSchema: toJSONSchema(ListMergeRequestDiscussionsSchema),
  },
  {
    name: "delete_merge_request_discussion_note",
    description: "Delete a discussion note on a merge request",
    inputSchema: toJSONSchema(DeleteMergeRequestDiscussionNoteSchema),
  },
  {
    name: "update_merge_request_discussion_note",
    description: "Update a discussion note on a merge request",
    inputSchema: toJSONSchema(UpdateMergeRequestDiscussionNoteSchema),
  },
  {
    name: "create_merge_request_discussion_note",
    description: "Add a new discussion note to an existing merge request thread",
    inputSchema: toJSONSchema(CreateMergeRequestDiscussionNoteSchema),
  },
  {
    name: "create_merge_request_note",
    description: "Add a new note to a merge request",
    inputSchema: toJSONSchema(CreateMergeRequestNoteSchema),
  },
  {
    name: "delete_merge_request_note",
    description: "Delete an existing merge request note",
    inputSchema: toJSONSchema(DeleteMergeRequestNoteSchema),
  },
  {
    name: "get_merge_request_note",
    description: "Get a specific note for a merge request",
    inputSchema: toJSONSchema(GetMergeRequestNoteSchema),
  },
  {
    name: "get_merge_request_notes",
    description: "List notes for a merge request",
    inputSchema: toJSONSchema(GetMergeRequestNotesSchema),
  },
  {
    name: "update_merge_request_note",
    description: "Modify an existing merge request note",
    inputSchema: toJSONSchema(UpdateMergeRequestNoteSchema),
  },
  {
    name: "get_draft_note",
    description: "Get a single draft note from a merge request",
    inputSchema: toJSONSchema(GetDraftNoteSchema),
  },
  {
    name: "list_draft_notes",
    description: "List draft notes for a merge request",
    inputSchema: toJSONSchema(ListDraftNotesSchema),
  },
  {
    name: "create_draft_note",
    description: "Create a draft note for a merge request",
    inputSchema: toJSONSchema(CreateDraftNoteSchema),
  },
  {
    name: "update_draft_note",
    description: "Update an existing draft note",
    inputSchema: toJSONSchema(UpdateDraftNoteSchema),
  },
  {
    name: "delete_draft_note",
    description: "Delete a draft note",
    inputSchema: toJSONSchema(DeleteDraftNoteSchema),
  },
  {
    name: "publish_draft_note",
    description: "Publish a single draft note",
    inputSchema: toJSONSchema(PublishDraftNoteSchema),
  },
  {
    name: "bulk_publish_draft_notes",
    description: "Publish all draft notes for a merge request",
    inputSchema: toJSONSchema(BulkPublishDraftNotesSchema),
  },
  {
    name: "update_issue_note",
    description: "Modify an existing issue thread note",
    inputSchema: toJSONSchema(UpdateIssueNoteSchema),
  },
  {
    name: "create_issue_note",
    description: "Add a new note to an existing issue thread",
    inputSchema: toJSONSchema(CreateIssueNoteSchema),
  },
  {
    name: "list_issues",
    description:
      "List issues (default: created by current user only; use scope='all' for all accessible issues)",
    inputSchema: toJSONSchema(ListIssuesSchema),
  },
  {
    name: "my_issues",
    description: "List issues assigned to the authenticated user (defaults to open issues)",
    inputSchema: toJSONSchema(MyIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue in a GitLab project",
    inputSchema: toJSONSchema(GetIssueSchema),
  },
  {
    name: "update_issue",
    description: "Update an issue in a GitLab project",
    inputSchema: toJSONSchema(UpdateIssueSchema),
  },
  {
    name: "delete_issue",
    description: "Delete an issue from a GitLab project",
    inputSchema: toJSONSchema(DeleteIssueSchema),
  },
  {
    name: "list_issue_links",
    description: "List all issue links for a specific issue",
    inputSchema: toJSONSchema(ListIssueLinksSchema),
  },
  {
    name: "list_issue_discussions",
    description: "List discussions for an issue in a GitLab project",
    inputSchema: toJSONSchema(ListIssueDiscussionsSchema),
  },
  {
    name: "get_issue_link",
    description: "Get a specific issue link",
    inputSchema: toJSONSchema(GetIssueLinkSchema),
  },
  {
    name: "create_issue_link",
    description: "Create an issue link between two issues",
    inputSchema: toJSONSchema(CreateIssueLinkSchema),
  },
  {
    name: "delete_issue_link",
    description: "Delete an issue link",
    inputSchema: toJSONSchema(DeleteIssueLinkSchema),
  },
  {
    name: "list_namespaces",
    description: "List all namespaces available to the current user",
    inputSchema: toJSONSchema(ListNamespacesSchema),
  },
  {
    name: "get_namespace",
    description: "Get details of a namespace by ID or path",
    inputSchema: toJSONSchema(GetNamespaceSchema),
  },
  {
    name: "verify_namespace",
    description: "Verify if a namespace path exists",
    inputSchema: toJSONSchema(VerifyNamespaceSchema),
  },
  {
    name: "get_project",
    description: "Get details of a specific project",
    inputSchema: toJSONSchema(GetProjectSchema),
  },
  {
    name: "list_projects",
    description: "List projects accessible by the current user",
    inputSchema: toJSONSchema(ListProjectsSchema),
  },
  {
    name: "list_project_members",
    description: "List members of a GitLab project",
    inputSchema: toJSONSchema(ListProjectMembersSchema),
  },
  {
    name: "list_labels",
    description: "List labels for a project",
    inputSchema: toJSONSchema(ListLabelsSchema),
  },
  {
    name: "get_label",
    description: "Get a single label from a project",
    inputSchema: toJSONSchema(GetLabelSchema),
  },
  {
    name: "create_label",
    description: "Create a new label in a project",
    inputSchema: toJSONSchema(CreateLabelSchema),
  },
  {
    name: "update_label",
    description: "Update an existing label in a project",
    inputSchema: toJSONSchema(UpdateLabelSchema),
  },
  {
    name: "delete_label",
    description: "Delete a label from a project",
    inputSchema: toJSONSchema(DeleteLabelSchema),
  },
  {
    name: "list_group_projects",
    description: "List projects in a GitLab group with filtering options",
    inputSchema: toJSONSchema(ListGroupProjectsSchema),
  },
  {
    name: "list_wiki_pages",
    description: "List wiki pages in a GitLab project",
    inputSchema: toJSONSchema(ListWikiPagesSchema),
  },
  {
    name: "get_wiki_page",
    description: "Get details of a specific wiki page",
    inputSchema: toJSONSchema(GetWikiPageSchema),
  },
  {
    name: "create_wiki_page",
    description: "Create a new wiki page in a GitLab project",
    inputSchema: toJSONSchema(CreateWikiPageSchema),
  },
  {
    name: "update_wiki_page",
    description: "Update an existing wiki page in a GitLab project",
    inputSchema: toJSONSchema(UpdateWikiPageSchema),
  },
  {
    name: "delete_wiki_page",
    description: "Delete a wiki page from a GitLab project",
    inputSchema: toJSONSchema(DeleteWikiPageSchema),
  },
  {
    name: "get_repository_tree",
    description: "Get the repository tree for a GitLab project (list files and directories)",
    inputSchema: toJSONSchema(GetRepositoryTreeSchema),
  },
  {
    name: "list_pipelines",
    description: "List pipelines in a GitLab project with filtering options",
    inputSchema: toJSONSchema(ListPipelinesSchema),
  },
  {
    name: "get_pipeline",
    description: "Get details of a specific pipeline in a GitLab project",
    inputSchema: toJSONSchema(GetPipelineSchema),
  },
  {
    name: "list_pipeline_jobs",
    description: "List all jobs in a specific pipeline",
    inputSchema: toJSONSchema(ListPipelineJobsSchema),
  },
  {
    name: "list_pipeline_trigger_jobs",
    description:
      "List all trigger jobs (bridges) in a specific pipeline that trigger downstream pipelines",
    inputSchema: toJSONSchema(ListPipelineTriggerJobsSchema),
  },
  {
    name: "get_pipeline_job",
    description: "Get details of a GitLab pipeline job number",
    inputSchema: toJSONSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "get_pipeline_job_output",
    description:
      "Get the output/trace of a GitLab pipeline job with optional pagination to limit context window usage",
    inputSchema: toJSONSchema(GetPipelineJobOutputSchema),
  },
  {
    name: "create_pipeline",
    description: "Create a new pipeline for a branch or tag",
    inputSchema: toJSONSchema(CreatePipelineSchema),
  },
  {
    name: "retry_pipeline",
    description: "Retry a failed or canceled pipeline",
    inputSchema: toJSONSchema(RetryPipelineSchema),
  },
  {
    name: "cancel_pipeline",
    description: "Cancel a running pipeline",
    inputSchema: toJSONSchema(CancelPipelineSchema),
  },
  {
    name: "play_pipeline_job",
    description: "Run a manual pipeline job",
    inputSchema: toJSONSchema(PlayPipelineJobSchema),
  },
  {
    name: "retry_pipeline_job",
    description: "Retry a failed or canceled pipeline job",
    inputSchema: toJSONSchema(RetryPipelineJobSchema),
  },
  {
    name: "cancel_pipeline_job",
    description: "Cancel a running pipeline job",
    inputSchema: toJSONSchema(CancelPipelineJobSchema),
  },
  {
    name: "list_merge_requests",
    description:
      "List merge requests. Without project_id, lists MRs assigned to the authenticated user by default (use scope='all' for all accessible MRs). With project_id, lists MRs for that specific project.",
    inputSchema: toJSONSchema(ListMergeRequestsSchema),
  },
  {
    name: "list_milestones",
    description: "List milestones in a GitLab project with filtering options",
    inputSchema: toJSONSchema(ListProjectMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get details of a specific milestone",
    inputSchema: toJSONSchema(GetProjectMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new milestone in a GitLab project",
    inputSchema: toJSONSchema(CreateProjectMilestoneSchema),
  },
  {
    name: "edit_milestone",
    description: "Edit an existing milestone in a GitLab project",
    inputSchema: toJSONSchema(EditProjectMilestoneSchema),
  },
  {
    name: "delete_milestone",
    description: "Delete a milestone from a GitLab project",
    inputSchema: toJSONSchema(DeleteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_issue",
    description: "Get issues associated with a specific milestone",
    inputSchema: toJSONSchema(GetMilestoneIssuesSchema),
  },
  {
    name: "get_milestone_merge_requests",
    description: "Get merge requests associated with a specific milestone",
    inputSchema: toJSONSchema(GetMilestoneMergeRequestsSchema),
  },
  {
    name: "promote_milestone",
    description: "Promote a milestone to the next stage",
    inputSchema: toJSONSchema(PromoteProjectMilestoneSchema),
  },
  {
    name: "get_milestone_burndown_events",
    description: "Get burndown events for a specific milestone",
    inputSchema: toJSONSchema(GetMilestoneBurndownEventsSchema),
  },
  {
    name: "get_users",
    description: "Get GitLab user details by usernames",
    inputSchema: toJSONSchema(GetUsersSchema),
  },
  {
    name: "list_commits",
    description: "List repository commits with filtering options",
    inputSchema: toJSONSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    description: "Get details of a specific commit",
    inputSchema: toJSONSchema(GetCommitSchema),
  },
  {
    name: "get_commit_diff",
    description: "Get changes/diffs of a specific commit",
    inputSchema: toJSONSchema(GetCommitDiffSchema),
  },
  {
    name: "list_group_iterations",
    description: "List group iterations with filtering options",
    inputSchema: toJSONSchema(ListGroupIterationsSchema),
  },
  {
    name: "upload_markdown",
    description: "Upload a file to a GitLab project for use in markdown content",
    inputSchema: toJSONSchema(MarkdownUploadSchema),
  },
  {
    name: "download_attachment",
    description:
      "Download an uploaded file from a GitLab project by secret and filename. Image files (png, jpg, gif, webp, svg, bmp, ico) are returned inline as base64 image content so the AI can view them directly. Non-image files are saved to disk. Use local_path to force saving image files to disk instead.",
    inputSchema: toJSONSchema(DownloadAttachmentSchema),
  },
  {
    name: "list_events",
    description:
      "List all events for the currently authenticated user. Note: before/after parameters accept date format YYYY-MM-DD only",
    inputSchema: toJSONSchema(ListEventsSchema),
  },
  {
    name: "get_project_events",
    description:
      "List all visible events for a specified project. Note: before/after parameters accept date format YYYY-MM-DD only",
    inputSchema: toJSONSchema(GetProjectEventsSchema),
  },
  {
    name: "list_releases",
    description: "List all releases for a project",
    inputSchema: toJSONSchema(ListReleasesSchema),
  },
  {
    name: "get_release",
    description: "Get a release by tag name",
    inputSchema: toJSONSchema(GetReleaseSchema),
  },
  {
    name: "create_release",
    description: "Create a new release in a GitLab project",
    inputSchema: toJSONSchema(CreateReleaseSchema),
  },
  {
    name: "update_release",
    description: "Update an existing release in a GitLab project",
    inputSchema: toJSONSchema(UpdateReleaseSchema),
  },
  {
    name: "delete_release",
    description: "Delete a release from a GitLab project (does not delete the associated tag)",
    inputSchema: toJSONSchema(DeleteReleaseSchema),
  },
  {
    name: "create_release_evidence",
    description: "Create release evidence for an existing release (GitLab Premium/Ultimate only)",
    inputSchema: toJSONSchema(CreateReleaseEvidenceSchema),
  },
  {
    name: "download_release_asset",
    description: "Download a release asset file by direct asset path",
    inputSchema: toJSONSchema(DownloadReleaseAssetSchema),
  },
];

// Define which tools are read-only
const readOnlyTools = new Set([
  "search_repositories",
  "execute_graphql",
  "get_file_contents",
  "get_merge_request",
  "get_merge_request_diffs",
  "list_merge_request_versions",
  "get_merge_request_version",
  "get_branch_diffs",
  "mr_discussions",
  "list_issues",
  "my_issues",
  "list_merge_requests",
  "get_issue",
  "list_issue_links",
  "list_issue_discussions",
  "get_issue_link",
  "list_namespaces",
  "get_namespace",
  "verify_namespace",
  "get_project",
  "list_projects",
  "list_project_members",
  "get_pipeline",
  "list_pipelines",
  "list_pipeline_jobs",
  "list_pipeline_trigger_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "list_labels",
  "get_label",
  "list_group_projects",
  "get_repository_tree",
  "list_milestones",
  "get_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "get_milestone_burndown_events",
  "list_wiki_pages",
  "get_wiki_page",
  "get_users",
  "list_commits",
  "get_commit",
  "get_commit_diff",
  "list_group_iterations",
  "get_group_iteration",
  "download_attachment",
  "list_events",
  "get_project_events",
  "list_releases",
  "get_release",
  "download_release_asset",
  "get_merge_request_approval_state",
]);

// Define which tools are related to wiki and can be toggled by USE_GITLAB_WIKI
const wikiToolNames = new Set([
  "list_wiki_pages",
  "get_wiki_page",
  "create_wiki_page",
  "update_wiki_page",
  "delete_wiki_page",
  "upload_wiki_attachment",
]);

// Define which tools are related to milestones and can be toggled by USE_MILESTONE
const milestoneToolNames = new Set([
  "list_milestones",
  "get_milestone",
  "create_milestone",
  "edit_milestone",
  "delete_milestone",
  "get_milestone_issue",
  "get_milestone_merge_requests",
  "promote_milestone",
  "get_milestone_burndown_events",
]);

// Define which tools are related to pipelines and can be toggled by USE_PIPELINE
const pipelineToolNames = new Set([
  "list_pipelines",
  "get_pipeline",
  "list_pipeline_jobs",
  "list_pipeline_trigger_jobs",
  "get_pipeline_job",
  "get_pipeline_job_output",
  "create_pipeline",
  "retry_pipeline",
  "cancel_pipeline",
  "play_pipeline_job",
  "retry_pipeline_job",
  "cancel_pipeline_job",
]);

// --- Toolset definitions ---

type ToolsetId =
  | "merge_requests"
  | "issues"
  | "repositories"
  | "branches"
  | "projects"
  | "labels"
  | "pipelines"
  | "milestones"
  | "wiki"
  | "releases"
  | "users";

interface ToolsetDefinition {
  readonly id: ToolsetId;
  readonly isDefault: boolean;
  readonly tools: ReadonlySet<string>;
}

const TOOLSET_DEFINITIONS: readonly ToolsetDefinition[] = [
  {
    id: "merge_requests",
    isDefault: true,
    tools: new Set([
      "merge_merge_request",
      "approve_merge_request",
      "unapprove_merge_request",
      "get_merge_request_approval_state",
      "get_merge_request",
      "get_merge_request_diffs",
      "list_merge_request_diffs",
      "list_merge_request_versions",
      "get_merge_request_version",
      "update_merge_request",
      "create_merge_request",
      "list_merge_requests",
      "get_branch_diffs",
      "mr_discussions",
      "create_merge_request_note",
      "update_merge_request_note",
      "delete_merge_request_note",
      "get_merge_request_note",
      "get_merge_request_notes",
      "delete_merge_request_discussion_note",
      "update_merge_request_discussion_note",
      "create_merge_request_discussion_note",
      "get_draft_note",
      "list_draft_notes",
      "create_draft_note",
      "update_draft_note",
      "delete_draft_note",
      "publish_draft_note",
      "bulk_publish_draft_notes",
      "create_merge_request_thread",
      "resolve_merge_request_thread",
    ]),
  },
  {
    id: "issues",
    isDefault: true,
    tools: new Set([
      "create_issue",
      "list_issues",
      "my_issues",
      "get_issue",
      "update_issue",
      "delete_issue",
      "create_issue_note",
      "update_issue_note",
      "list_issue_links",
      "list_issue_discussions",
      "get_issue_link",
      "create_issue_link",
      "delete_issue_link",
      "create_note",
    ]),
  },
  {
    id: "repositories",
    isDefault: true,
    tools: new Set([
      "search_repositories",
      "create_repository",
      "get_file_contents",
      "push_files",
      "create_or_update_file",
      "fork_repository",
      "get_repository_tree",
    ]),
  },
  {
    id: "branches",
    isDefault: true,
    tools: new Set([
      "create_branch",
      "list_commits",
      "get_commit",
      "get_commit_diff",
    ]),
  },
  {
    id: "projects",
    isDefault: true,
    tools: new Set([
      "get_project",
      "list_projects",
      "list_project_members",
      "list_namespaces",
      "get_namespace",
      "verify_namespace",
      "list_group_projects",
      "list_group_iterations",
    ]),
  },
  {
    id: "labels",
    isDefault: true,
    tools: new Set([
      "list_labels",
      "get_label",
      "create_label",
      "update_label",
      "delete_label",
    ]),
  },
  {
    id: "pipelines",
    isDefault: false,
    tools: new Set([
      "list_pipelines",
      "get_pipeline",
      "list_pipeline_jobs",
      "list_pipeline_trigger_jobs",
      "get_pipeline_job",
      "get_pipeline_job_output",
      "create_pipeline",
      "retry_pipeline",
      "cancel_pipeline",
      "play_pipeline_job",
      "retry_pipeline_job",
      "cancel_pipeline_job",
    ]),
  },
  {
    id: "milestones",
    isDefault: false,
    tools: new Set([
      "list_milestones",
      "get_milestone",
      "create_milestone",
      "edit_milestone",
      "delete_milestone",
      "get_milestone_issue",
      "get_milestone_merge_requests",
      "promote_milestone",
      "get_milestone_burndown_events",
    ]),
  },
  {
    id: "wiki",
    isDefault: false,
    tools: new Set([
      "list_wiki_pages",
      "get_wiki_page",
      "create_wiki_page",
      "update_wiki_page",
      "delete_wiki_page",
    ]),
  },
  {
    id: "releases",
    isDefault: true,
    tools: new Set([
      "list_releases",
      "get_release",
      "create_release",
      "update_release",
      "delete_release",
      "create_release_evidence",
      "download_release_asset",
    ]),
  },
  {
    id: "users",
    isDefault: true,
    tools: new Set([
      "get_users",
      "list_events",
      "get_project_events",
      "upload_markdown",
      "download_attachment",
    ]),
  },
] as const;

// Derived lookup: tool name → toolset ID
const TOOLSET_BY_TOOL_NAME = new Map<string, ToolsetId>();
for (const def of TOOLSET_DEFINITIONS) {
  for (const tool of def.tools) {
    TOOLSET_BY_TOOL_NAME.set(tool, def.id);
  }
}

const DEFAULT_TOOLSET_IDS: ReadonlySet<ToolsetId> = new Set(
  TOOLSET_DEFINITIONS.filter(d => d.isDefault).map(d => d.id)
);

const ALL_TOOLSET_IDS: ReadonlySet<ToolsetId> = new Set(
  TOOLSET_DEFINITIONS.map(d => d.id)
);

function parseEnabledToolsets(raw: string | undefined): ReadonlySet<ToolsetId> {
  if (!raw || raw.trim() === "") {
    return DEFAULT_TOOLSET_IDS;
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "all") {
    return ALL_TOOLSET_IDS;
  }
  const selected = new Set(
    trimmed
      .split(",")
      .map(s => s.trim())
      .filter((s): s is ToolsetId => ALL_TOOLSET_IDS.has(s as ToolsetId))
  );
  if (selected.size === 0) {
    console.warn(
      `No valid toolsets found in configuration (${raw}). Falling back to default toolsets.`
    );
    return DEFAULT_TOOLSET_IDS;
  }
  return selected;
}

function parseIndividualTools(raw: string | undefined): ReadonlySet<string> {
  if (!raw || raw.trim() === "") {
    return new Set();
  }
  return new Set(
    raw
      .trim()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
}

function buildFeatureFlagOverrides(): ReadonlySet<string> {
  const overrides = new Set<string>();
  if (USE_GITLAB_WIKI) {
    for (const t of wikiToolNames) overrides.add(t);
  }
  if (USE_MILESTONE) {
    for (const t of milestoneToolNames) overrides.add(t);
  }
  if (USE_PIPELINE) {
    for (const t of pipelineToolNames) overrides.add(t);
  }
  return overrides;
}

function isToolInEnabledToolset(
  toolName: string,
  enabledToolsets: ReadonlySet<ToolsetId>
): boolean {
  const toolsetId = TOOLSET_BY_TOOL_NAME.get(toolName);
  // Tools not in any toolset (e.g. execute_graphql) are excluded by default
  if (toolsetId === undefined) return false;
  return enabledToolsets.has(toolsetId);
}

// Compute at startup
const enabledToolsets = parseEnabledToolsets(GITLAB_TOOLSETS_RAW);
const individuallyEnabledTools = parseIndividualTools(GITLAB_TOOLS_RAW);
const featureFlagOverrides = buildFeatureFlagOverrides();

/**
 * Smart URL handling for GitLab API
 *
 * @param {string | undefined} url - Input GitLab API URL
 * @returns {string} Normalized GitLab API URL with /api/v4 path
 */
function normalizeGitLabApiUrl(url: string): string {
  if (!url) {
    return "https://gitlab.com/api/v4";
  }
  let normalizedUrl = url.trim();
  if (normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  if (!normalizedUrl.endsWith("/api/v4")) {
    normalizedUrl = `${normalizedUrl}/api/v4`;
  }
  return normalizedUrl;
}

// Use the normalizeGitLabApiUrl function to handle various URL formats
const GITLAB_API_URLS = (getConfig("api-url", "GITLAB_API_URL") || "https://gitlab.com")
  .split(",")
  .map(normalizeGitLabApiUrl);
const GITLAB_API_URL = GITLAB_API_URLS[0];
const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const GITLAB_ALLOWED_PROJECT_IDS =
  process.env.GITLAB_ALLOWED_PROJECT_IDS?.split(",")
    .map(id => id.trim())
    .filter(Boolean) || [];

const GITLAB_COMMIT_FILES_PER_PAGE = process.env.GITLAB_COMMIT_FILES_PER_PAGE
  ? Number.parseInt(process.env.GITLAB_COMMIT_FILES_PER_PAGE, 10)
  : 20;

// Validate authentication configuration
if (REMOTE_AUTHORIZATION) {
  // Remote authorization mode: token comes from HTTP headers
  if (SSE) {
    logger.error("REMOTE_AUTHORIZATION=true is not compatible with SSE transport mode");
    logger.error("Please use STREAMABLE_HTTP=true instead");
    process.exit(1);
  }
  if (!STREAMABLE_HTTP) {
    logger.error("REMOTE_AUTHORIZATION=true requires STREAMABLE_HTTP=true");
    logger.error("Set STREAMABLE_HTTP=true to enable remote authorization");
    process.exit(1);
  }
  logger.info("Remote authorization enabled: tokens will be read from HTTP headers");
} else if (!USE_OAUTH && !GITLAB_PERSONAL_ACCESS_TOKEN && !GITLAB_AUTH_COOKIE_PATH) {
  // Standard mode: token must be in environment (unless using OAuth)
  logger.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  logger.info("Either set GITLAB_PERSONAL_ACCESS_TOKEN or enable OAuth with GITLAB_USE_OAUTH=true");
  process.exit(1);
}

/**
 * Utility function for handling GitLab API errors
 * API 에러 처리를 위한 유틸리티 함수 (Utility function for handling API errors)
 *
 * @param {import("node-fetch").Response} response - The response from GitLab API
 * @throws {Error} Throws an error with response details if the request failed
 */
async function handleGitLabError(response: import("node-fetch").Response): Promise<void> {
  if (!response.ok) {
    const errorBody = await response.text();
    // Check specifically for Rate Limit error
    if (response.status === 403 && errorBody.includes("User API Key Rate limit exceeded")) {
      logger.error("GitLab API Rate Limit Exceeded:", errorBody);
      logger.error("User API Key Rate limit exceeded. Please try again later.");
      throw new Error(`GitLab API Rate Limit Exceeded: ${errorBody}`);
    } else {
      // Handle other API errors
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }
  }
}

/**
 * @param {string} projectId - The project ID parameter passed to the function
 * @returns {string} The project ID to use for the API call
 * @throws {Error} If GITLAB_ALLOWED_PROJECT_IDS is set and the requested project is not in the whitelist
 */
function getEffectiveProjectId(projectId: string): string {
  if (GITLAB_ALLOWED_PROJECT_IDS.length > 0) {
    // If there's only one allowed project, use it as default
    if (GITLAB_ALLOWED_PROJECT_IDS.length === 1 && !projectId) {
      return GITLAB_ALLOWED_PROJECT_IDS[0];
    }

    // If a project ID is provided, check if it's in the whitelist
    if (projectId && !GITLAB_ALLOWED_PROJECT_IDS.includes(projectId)) {
      throw new Error(
        `Access denied: Project ${projectId} is not in the allowed project list: ${GITLAB_ALLOWED_PROJECT_IDS.join(", ")}`
      );
    }

    // If no project ID provided but we have multiple allowed projects, require an explicit choice
    if (!projectId && GITLAB_ALLOWED_PROJECT_IDS.length > 1) {
      throw new Error(
        `Multiple projects allowed (${GITLAB_ALLOWED_PROJECT_IDS.join(", ")}). Please specify a project ID.`
      );
    }

    return projectId || GITLAB_ALLOWED_PROJECT_IDS[0];
  }
  return GITLAB_PROJECT_ID || projectId;
}

/**
 * Create a fork of a GitLab project
 * 프로젝트 포크 생성 (Create a project fork)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} [namespace] - The namespace to fork the project to
 * @returns {Promise<GitLabFork>} The created fork
 */
async function forkProject(projectId: string, namespace?: string): Promise<GitLabFork> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/fork`
  );

  if (namespace) {
    url.searchParams.append("namespace", namespace);
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
  });

  // 이미 존재하는 프로젝트인 경우 처리
  if (response.status === 409) {
    throw new Error("Project already exists in the target namespace");
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabForkSchema.parse(data);
}

/**
 * Create a new branch in a GitLab project
 * 새로운 브랜치 생성 (Create a new branch)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {z.infer<typeof CreateBranchOptionsSchema>} options - Branch creation options
 * @returns {Promise<GitLabReference>} The created branch reference
 */
async function createBranch(
  projectId: string,
  options: z.infer<typeof CreateBranchOptionsSchema>
): Promise<GitLabReference> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/repository/branches`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      branch: options.name,
      ref: options.ref,
    }),
  });

  await handleGitLabError(response);
  return GitLabReferenceSchema.parse(await response.json());
}

/**
 * Get the default branch for a GitLab project
 * 프로젝트의 기본 브랜치 조회 (Get the default branch of a project)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @returns {Promise<string>} The name of the default branch
 */
async function getDefaultBranchRef(projectId: string): Promise<string> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(`${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}`);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const project = GitLabRepositorySchema.parse(await response.json());
  return project.default_branch ?? "main";
}

/**
 * Get the contents of a file from a GitLab project
 * 파일 내용 조회 (Get file contents)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} filePath - The path of the file to get
 * @param {string} [ref] - The name of the branch, tag or commit
 * @returns {Promise<GitLabContent>} The file content
 */
async function getFileContents(
  projectId: string,
  filePath: string,
  ref?: string
): Promise<GitLabContent> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const encodedPath = encodeURIComponent(filePath);

  // ref가 없는 경우 default branch를 가져옴
  if (!ref) {
    ref = await getDefaultBranchRef(projectId);
  }

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/repository/files/${encodedPath}`
  );

  url.searchParams.append("ref", ref);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  // 파일을 찾을 수 없는 경우 처리
  if (response.status === 404) {
    throw new Error(`File not found: ${filePath}`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  const parsedData = GitLabContentSchema.parse(data);

  // Base64로 인코딩된 파일 내용을 UTF-8로 디코딩
  if (!Array.isArray(parsedData) && parsedData.content) {
    parsedData.content = Buffer.from(parsedData.content, "base64").toString("utf8");
    parsedData.encoding = "utf8";
  }

  return parsedData;
}

/**
 * Create a new issue in a GitLab project
 * 이슈 생성 (Create an issue)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {z.infer<typeof CreateIssueOptionsSchema>} options - Issue creation options
 * @returns {Promise<GitLabIssue>} The created issue
 */
async function createIssue(
  projectId: string,
  options: z.infer<typeof CreateIssueOptionsSchema>
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/issues`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      description: options.description,
      assignee_ids: options.assignee_ids,
      milestone_id: options.milestone_id,
      labels: options.labels?.join(","),
    }),
  });

  // 잘못된 요청 처리
  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * List issues across all accessible projects or within a specific project
 * 프로젝트의 이슈 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project (optional)
 * @param {Object} options - Options for listing issues
 * @returns {Promise<GitLabIssue[]>} List of issues
 */
async function listIssues(
  projectId?: string,
  options: Omit<z.infer<typeof ListIssuesSchema>, "project_id"> = {}
): Promise<GitLabIssue[]> {
  let url: URL;
  if (projectId) {
    projectId = decodeURIComponent(projectId); // Decode project ID
    const effectiveProjectId = getEffectiveProjectId(projectId);
    url = new URL(
      `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/issues`
    );
  } else {
    url = new URL(`${getEffectiveApiUrl()}/issues`);
  }

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      const keys = ["labels", "assignee_username"];
      if (keys.includes(key)) {
        if (Array.isArray(value)) {
          // Handle array of labels
          value.forEach(label => {
            url.searchParams.append(`${key}[]`, label.toString());
          });
        } else if (value) {
          url.searchParams.append(`${key}[]`, value.toString());
        }
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueSchema).parse(data);
}

/**
 * List merge requests globally or for a specific GitLab project
 *
 * @param {string} [projectId] - The ID or URL-encoded path of the project.
 *                               If omitted, lists MRs assigned to the authenticated user by default.
 * @param {Object} options - Optional filtering parameters
 * @returns {Promise<GitLabMergeRequest[]>} List of merge requests
 */
async function listMergeRequests(
  projectId?: string,
  options: Omit<z.infer<typeof ListMergeRequestsSchema>, "project_id"> = {}
): Promise<GitLabMergeRequest[]> {
  const decodedProjectId = projectId ? decodeURIComponent(projectId) : undefined;
  const endpoint = decodedProjectId
    ? `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(decodedProjectId))}/merge_requests`
    : `${getEffectiveApiUrl()}/merge_requests`;
  const url = new URL(endpoint);

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "labels" && Array.isArray(value)) {
        // Handle array of labels
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestSchema).parse(data);
}

/**
 * Get a single issue from a GitLab project
 * 단일 이슈 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<GitLabIssue>} The issue
 */
async function getIssue(projectId: string, issueIid: number | string): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * Update an issue in a GitLab project
 * 이슈 업데이트
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {Object} options - Update options for the issue
 * @returns {Promise<GitLabIssue>} The updated issue
 */
async function updateIssue(
  projectId: string,
  issueIid: number | string,
  options: Omit<z.infer<typeof UpdateIssueSchema>, "project_id" | "issue_iid">
): Promise<GitLabIssue> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}`
  );

  // Convert labels array to comma-separated string if present
  const body: Record<string, any> = { ...options };
  if (body.labels && Array.isArray(body.labels)) {
    body.labels = body.labels.join(",");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueSchema.parse(data);
}

/**
 * Delete an issue from a GitLab project
 * 이슈 삭제
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<void>}
 */
async function deleteIssue(projectId: string, issueIid: number | string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });

  await handleGitLabError(response);
}

/**
 * List all issue links for a specific issue
 * 이슈 관계 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @returns {Promise<GitLabIssueWithLinkDetails[]>} List of issues with link details
 */
async function listIssueLinks(
  projectId: string,
  issueIid: number | string
): Promise<GitLabIssueWithLinkDetails[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}/links`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueWithLinkDetailsSchema).parse(data);
}

/**
 * Get a specific issue link
 * 특정 이슈 관계 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {number} issueLinkId - The ID of the issue link
 * @returns {Promise<GitLabIssueLink>} The issue link
 */
async function getIssueLink(
  projectId: string,
  issueIid: number | string,
  issueLinkId: number | string
): Promise<GitLabIssueLink> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/links/${issueLinkId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueLinkSchema.parse(data);
}

/**
 * Create an issue link between two issues
 * 이슈 관계 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {string} targetProjectId - The ID or URL-encoded path of the target project
 * @param {number} targetIssueIid - The internal ID of the target project issue
 * @param {string} linkType - The type of the relation (relates_to, blocks, is_blocked_by)
 * @returns {Promise<GitLabIssueLink>} The created issue link
 */
async function createIssueLink(
  projectId: string,
  issueIid: number | string,
  targetProjectId: string,
  targetIssueIid: number | string,
  linkType: "relates_to" | "blocks" | "is_blocked_by" = "relates_to"
): Promise<GitLabIssueLink> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  targetProjectId = decodeURIComponent(targetProjectId); // Decode target project ID as well
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/issues/${issueIid}/links`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      target_project_id: targetProjectId,
      target_issue_iid: targetIssueIid,
      link_type: linkType,
    }),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabIssueLinkSchema.parse(data);
}

/**
 * Delete an issue link
 * 이슈 관계 삭제
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {number} issueLinkId - The ID of the issue link
 * @returns {Promise<void>}
 */
async function deleteIssueLink(
  projectId: string,
  issueIid: number | string,
  issueLinkId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/links/${issueLinkId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });

  await handleGitLabError(response);
}

/**
 * Create a new merge request in a GitLab project
 * 병합 요청 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {z.infer<typeof CreateMergeRequestOptionsSchema>} options - Merge request creation options
 * @returns {Promise<GitLabMergeRequest>} The created merge request
 */
async function createMergeRequest(
  projectId: string,
  options: z.infer<typeof CreateMergeRequestOptionsSchema>
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      description: options.description,
      source_branch: options.source_branch,
      target_branch: options.target_branch,
      target_project_id: options.target_project_id,
      assignee_ids: options.assignee_ids,
      reviewer_ids: options.reviewer_ids,
      labels: options.labels?.join(","),
      allow_collaboration: options.allow_collaboration,
      draft: options.draft,
      remove_source_branch: options.remove_source_branch,
      squash: options.squash,
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabMergeRequestSchema.parse(data);
}

/**
 * Shared helper function for listing discussions
 * 토론 목록 조회를 위한 공유 헬퍼 함수
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {"issues" | "merge_requests"} resourceType - The type of resource (issues or merge_requests)
 * @param {number} resourceIid - The IID of the issue or merge request
 * @param {PaginationOptions} options - Pagination and sorting options
 * @returns {Promise<PaginatedDiscussionsResponse>} Paginated list of discussions
 */
async function listDiscussions(
  projectId: string,
  resourceType: "issues" | "merge_requests",
  resourceIid: number | string,
  options: PaginationOptions = {}
): Promise<PaginatedDiscussionsResponse> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/${resourceType}/${resourceIid}/discussions`
  );

  // Add query parameters for pagination and sorting
  if (options.page) {
    url.searchParams.append("page", options.page.toString());
  }
  if (options.per_page) {
    url.searchParams.append("per_page", options.per_page.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const discussions = await response.json();

  // Extract pagination headers
  const pagination = {
    x_next_page: response.headers.get("x-next-page")
      ? Number.parseInt(response.headers.get("x-next-page")!, 10)
      : null,
    x_page: response.headers.get("x-page")
      ? Number.parseInt(response.headers.get("x-page")!, 10)
      : undefined,
    x_per_page: response.headers.get("x-per-page")
      ? Number.parseInt(response.headers.get("x-per-page")!, 10)
      : undefined,
    x_prev_page: response.headers.get("x-prev-page")
      ? Number.parseInt(response.headers.get("x-prev-page")!, 10)
      : null,
    x_total: response.headers.get("x-total")
      ? Number.parseInt(response.headers.get("x-total")!, 10)
      : null,
    x_total_pages: response.headers.get("x-total-pages")
      ? Number.parseInt(response.headers.get("x-total-pages")!, 10)
      : null,
  };

  return PaginatedDiscussionsResponseSchema.parse({
    items: discussions,
    pagination: pagination,
  });
}

/**
 * List merge request discussion items
 * 병합 요청 토론 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @param {DiscussionPaginationOptions} options - Pagination and sorting options
 * @returns {Promise<GitLabDiscussion[]>} List of discussions
 */
async function listMergeRequestDiscussions(
  projectId: string,
  mergeRequestIid: number | string,
  options: PaginationOptions = {}
): Promise<PaginatedDiscussionsResponse> {
  return listDiscussions(projectId, "merge_requests", mergeRequestIid, options);
}

/**
 * List discussions for an issue
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The internal ID of the project issue
 * @param {DiscussionPaginationOptions} options - Pagination and sorting options
 * @returns {Promise<GitLabDiscussion[]>} List of issue discussions
 */
async function listIssueDiscussions(
  projectId: string,
  issueIid: number | string,
  options: PaginationOptions = {}
): Promise<PaginatedDiscussionsResponse> {
  return listDiscussions(projectId, "issues", issueIid, options);
}

async function deleteMergeRequestDiscussionNote(
  projectId: string,
  mergeRequestIid: number | string,
  discussionId: string,
  noteId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes/${noteId}`
  );
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Modify an existing merge request thread note
 * 병합 요청 토론 노트 수정
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @param {string} discussionId - The ID of a thread
 * @param {number} noteId - The ID of a thread note
 * @param {string} body - The new content of the note
 * @param {boolean} [resolved] - Resolve/unresolve state
 * @returns {Promise<GitLabDiscussionNote>} The updated note
 */
async function updateMergeRequestDiscussionNote(
  projectId: string,
  mergeRequestIid: number | string,
  discussionId: string,
  noteId: number | string,
  body?: string,
  resolved?: boolean
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes/${noteId}`
  );

  // Only one of body or resolved can be sent according to GitLab API
  const payload: { body?: string; resolved?: boolean } = {};
  if (body !== undefined) {
    payload.body = body;
  } else if (resolved !== undefined) {
    payload.resolved = resolved;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Update an issue discussion note
 *
 * Note: Only one of `body` or `resolved` can be provided per GitLab API requirements.
 * At least one parameter must be provided.
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} issueIid - The IID of an issue
 * @param {string} discussionId - The ID of a thread
 * @param {number|string} noteId - The ID of a thread note
 * @param {string} [body] - The new content of the note (optional, mutually exclusive with resolved)
 * @param {boolean} [resolved] - Resolve (true) or unresolve (false) the thread (optional, mutually exclusive with body)
 * @returns {Promise<GitLabDiscussionNote>} The updated note
 *
 * @example
 * // Resolve a thread
 * await updateIssueNote('mygroup/myproject', 123, 'abc123', 456, undefined, true);
 *
 * @example
 * // Unresolve a thread
 * await updateIssueNote('mygroup/myproject', 123, 'abc123', 456, undefined, false);
 *
 * @example
 * // Update note body
 * await updateIssueNote('mygroup/myproject', 123, 'abc123', 456, 'Updated content');
 */
async function updateIssueNote(
  projectId: string,
  issueIid: number | string,
  discussionId: string,
  noteId: number | string,
  body?: string,
  resolved?: boolean
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/discussions/${discussionId}/notes/${noteId}`
  );

  // Only one of body or resolved can be sent according to GitLab API
  const payload: { body?: string; resolved?: boolean } = {};
  if (body !== undefined) {
    payload.body = body;
  } else if (resolved !== undefined) {
    payload.resolved = resolved;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Create a note in an issue discussion
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} issueIid - The IID of an issue
 * @param {string} discussionId - The ID of a thread
 * @param {string} body - The content of the new note
 * @param {string} [createdAt] - The creation date of the note (ISO 8601 format)
 * @returns {Promise<GitLabDiscussionNote>} The created note
 */
async function createIssueNote(
  projectId: string,
  issueIid: number | string,
  discussionId: string,
  body: string,
  createdAt?: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/issues/${issueIid}/discussions/${discussionId}/notes`
  );

  const payload: { body: string; created_at?: string } = { body };
  if (createdAt) {
    payload.created_at = createdAt;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Add a new discussion note to an existing merge request thread
 * 기존 병합 요청 스레드에 새 노트 추가
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The IID of a merge request
 * @param {string} discussionId - The ID of a thread
 * @param {string} body - The content of the new note
 * @param {string} [createdAt] - The creation date of the note (ISO 8601 format)
 * @returns {Promise<GitLabDiscussionNote>} The created note
 */
async function createMergeRequestDiscussionNote(
  projectId: string,
  mergeRequestIid: number | string,
  discussionId: string,
  body: string,
  createdAt?: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions/${discussionId}/notes`
  );

  const payload: { body: string; created_at?: string } = { body };
  if (createdAt) {
    payload.created_at = createdAt;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

async function createMergeRequestNote(
  projectId: string,
  mergeRequestIid: number | string,
  body: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/notes`
  );

  const payload = {
    id: projectId,
    merge_request_iid: mergeRequestIid,
    body,
  };

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

async function deleteMergeRequestNote(
  projectId: string,
  mergeRequestIid: string,
  noteId: string
): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/notes/${noteId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

async function getMergeRequestNote(
  projectId: string,
  mergeRequestIid: string,
  noteId: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/notes/${noteId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "GET",
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

async function getMergeRequestNotes(
  projectId: string,
  mergeRequestIid: string,
  sort?: "asc" | "desc",
  order_by?: "created_at" | "updated_at",
  per_page?: number,
  page?: number
): Promise<GitLabDiscussionNote[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/notes`
  );

  if (sort) {
    url.searchParams.append("sort", sort);
  }

  if (order_by) {
    url.searchParams.append("order_by", order_by);
  }

  if (per_page) {
    url.searchParams.append("per_page", per_page.toString());
  }

  if (page) {
    url.searchParams.append("page", page.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "GET",
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabDiscussionNoteSchema).parse(data);
}

async function updateMergeRequestNote(
  projectId: string,
  mergeRequestIid: string,
  noteId: string,
  body: string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/notes/${noteId}`
  );

  const payload = {
    id: projectId,
    merge_request_iid: mergeRequestIid,
    note_id: noteId,
    body,
  };

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionNoteSchema.parse(data);
}

/**
 * Create or update a file in a GitLab project
 * 파일 생성 또는 업데이트
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} filePath - The path of the file to create or update
 * @param {string} content - The content of the file
 * @param {string} commitMessage - The commit message
 * @param {string} branch - The branch name
 * @param {string} [previousPath] - The previous path of the file in case of rename
 * @returns {Promise<GitLabCreateUpdateFileResponse>} The file update response
 */
async function createOrUpdateFile(
  projectId: string,
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string,
  previousPath?: string,
  last_commit_id?: string,
  commit_id?: string
): Promise<GitLabCreateUpdateFileResponse> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const encodedPath = encodeURIComponent(filePath);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/files/${encodedPath}`
  );

  const body: Record<string, any> = {
    branch,
    content,
    commit_message: commitMessage,
    encoding: "text",
    ...(previousPath ? { previous_path: previousPath } : {}),
  };

  // Check if file exists
  let method = "POST";
  try {
    // Get file contents to check existence and retrieve commit IDs
    const fileData = await getFileContents(projectId, filePath, branch);
    method = "PUT";

    // If fileData is not an array, it's a file content object with commit IDs
    if (!Array.isArray(fileData)) {
      // Use commit IDs from the file data if not provided in parameters
      if (!commit_id && fileData.commit_id) {
        body.commit_id = fileData.commit_id;
      } else if (commit_id) {
        body.commit_id = commit_id;
      }

      if (!last_commit_id && fileData.last_commit_id) {
        body.last_commit_id = fileData.last_commit_id;
      } else if (last_commit_id) {
        body.last_commit_id = last_commit_id;
      }
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("File not found"))) {
      throw error;
    }
    // File doesn't exist, use POST - no need for commit IDs for new files
    // But still use any provided as parameters if they exist
    if (commit_id) {
      body.commit_id = commit_id;
    }
    if (last_commit_id) {
      body.last_commit_id = last_commit_id;
    }
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabCreateUpdateFileResponseSchema.parse(data);
}

/**
 * Create a tree structure in a GitLab project repository
 * 저장소에 트리 구조 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {FileOperation[]} files - Array of file operations
 * @param {string} [ref] - The name of the branch, tag or commit
 * @returns {Promise<GitLabTree>} The created tree
 */
async function createTree(
  projectId: string,
  files: FileOperation[],
  ref?: string
): Promise<GitLabTree> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/tree`
  );

  if (ref) {
    url.searchParams.append("ref", ref);
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      files: files.map(file => ({
        file_path: file.path,
        content: file.content,
        encoding: "text",
      })),
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabTreeSchema.parse(data);
}

/**
 * Create a commit in a GitLab project repository
 * 저장소에 커밋 생성
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} message - The commit message
 * @param {string} branch - The branch name
 * @param {FileOperation[]} actions - Array of file operations for the commit
 * @returns {Promise<GitLabCommit>} The created commit
 */
async function createCommit(
  projectId: string,
  message: string,
  branch: string,
  actions: FileOperation[]
): Promise<GitLabCommit> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      branch,
      commit_message: message,
      actions: actions.map(action => ({
        action: "create",
        file_path: action.path,
        content: action.content,
        encoding: "text",
      })),
    }),
  });

  if (response.status === 400) {
    const errorBody = await response.text();
    throw new Error(`Invalid request: ${errorBody}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabCommitSchema.parse(data);
}

/**
 * Search for GitLab projects
 * 프로젝트 검색
 *
 * @param {string} query - The search query
 * @param {number} [page=1] - The page number
 * @param {number} [perPage=20] - Number of items per page
 * @returns {Promise<GitLabSearchResponse>} The search results
 */
async function searchProjects(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<GitLabSearchResponse> {
  const url = new URL(`${getEffectiveApiUrl()}/projects`);
  url.searchParams.append("search", query);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", perPage.toString());
  url.searchParams.append("order_by", "id");
  url.searchParams.append("sort", "desc");

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const projects = (await response.json()) as GitLabRepository[];
  const totalCount = response.headers.get("x-total");
  const totalPages = response.headers.get("x-total-pages");

  // GitLab API doesn't return these headers for results > 10,000
  const count = totalCount ? Number.parseInt(totalCount, 10) : projects.length;

  return GitLabSearchResponseSchema.parse({
    count,
    total_pages: totalPages ? Number.parseInt(totalPages, 10) : Math.ceil(count / perPage),
    current_page: page,
    items: projects,
  });
}

/**
 * Create a new GitLab repository
 * 새 저장소 생성
 *
 * @param {z.infer<typeof CreateRepositoryOptionsSchema>} options - Repository creation options
 * @returns {Promise<GitLabRepository>} The created repository
 */
async function createRepository(
  options: z.infer<typeof CreateRepositoryOptionsSchema>
): Promise<GitLabRepository> {
  const response = await fetch(`${getEffectiveApiUrl()}/projects`, {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      description: options.description,
      visibility: options.visibility,
      initialize_with_readme: options.initialize_with_readme,
      default_branch: "main",
      path: options.name.toLowerCase().replaceAll(/\s+/g, "-"),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabRepositorySchema.parse(data);
}

/**
 * Get merge request details
 * MR 조회 함수 (Function to retrieve merge request)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Optional)
 * @param {string} [branchName] - The name of the branch to search for merge request by branch name (Optional)
 * @returns {Promise<GitLabMergeRequest>} The merge request details
 */
async function getMergeRequest(
  projectId: string,
  mergeRequestIid?: number | string,
  branchName?: string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  let url: URL;

  if (mergeRequestIid) {
    url = new URL(
      `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
        getEffectiveProjectId(projectId)
      )}/merge_requests/${mergeRequestIid}`
    );
  } else if (branchName) {
    url = new URL(
      `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
        getEffectiveProjectId(projectId)
      )}/merge_requests?source_branch=${encodeURIComponent(branchName)}`
    );
  } else {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();

  // If response is an array (Comes from branchName search), return the first item if exist
  if (Array.isArray(data) && data.length > 0) {
    return GitLabMergeRequestSchema.parse(data[0]);
  }

  return GitLabMergeRequestSchema.parse(data);
}

/**
 * Get merge request changes/diffs
 * MR 변경사항 조회 함수 (Function to retrieve merge request changes)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Either mergeRequestIid or branchName must be provided)
 * @param {string} [branchName] - The name of the branch to search for merge request by branch name (Either mergeRequestIid or branchName must be provided)
 * @param {string} [view] - The view type for the diff (inline or parallel)
 * @returns {Promise<GitLabMergeRequestDiff[]>} The merge request diffs
 */
async function getMergeRequestDiffs(
  projectId: string,
  mergeRequestIid?: number | string,
  branchName?: string,
  view?: "inline" | "parallel"
): Promise<GitLabMergeRequestDiff[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(projectId, undefined, branchName);
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/changes`
  );

  if (view) {
    url.searchParams.append("view", view);
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = (await response.json()) as { changes: unknown };
  return z.array(GitLabDiffSchema).parse(data.changes);
}

/**
 * Get merge request changes with detailed information including commits, diff_refs, and more
 * 마지막으로 추가된 상세한 MR 변경사항 조회 함수 (Detailed merge request changes retrieval function)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Either mergeRequestIid or branchName must be provided)
 * @param {string} [branchName] - The name of the branch to search for merge request by branch name (Either mergeRequestIid or branchName must be provided)
 * @param {boolean} [unidiff] - Return diff in unidiff format
 * @returns {Promise<any>} The complete merge request changes response
 */
async function listMergeRequestDiffs(
  projectId: string,
  mergeRequestIid?: number | string,
  branchName?: string,
  page?: number,
  perPage?: number,
  unidiff?: boolean
): Promise<any> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(projectId, undefined, branchName);
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/diffs`
  );

  if (page) {
    url.searchParams.append("page", page.toString());
  }

  if (perPage) {
    url.searchParams.append("per_page", perPage.toString());
  }

  if (unidiff) {
    url.searchParams.append("unidiff", "true");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  return await response.json(); // Return full response including commits, diff_refs, changes, etc.
}

/**
 * Get branch comparison diffs
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} from - The branch name or commit SHA to compare from
 * @param {string} to - The branch name or commit SHA to compare to
 * @param {boolean} [straight] - Comparison method: false for '...' (default), true for '--'
 * @returns {Promise<GitLabCompareResult>} Branch comparison results
 */
async function getBranchDiffs(
  projectId: string,
  from: string,
  to: string,
  straight?: boolean
): Promise<GitLabCompareResult> {
  projectId = decodeURIComponent(projectId); // Decode project ID

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/compare`
  );

  url.searchParams.append("from", from);
  url.searchParams.append("to", to);

  if (straight !== undefined) {
    url.searchParams.append("straight", straight.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json();
  return GitLabCompareResultSchema.parse(data);
}

/**
 * Update a merge request
 * MR 업데이트 함수 (Function to update merge request)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request (Optional)
 * @param {string} branchName - The name of the branch to search for merge request by branch name (Optional)
 * @param {Object} options - The update options
 * @returns {Promise<GitLabMergeRequest>} The updated merge request
 */
async function updateMergeRequest(
  projectId: string,
  options: Omit<
    z.infer<typeof UpdateMergeRequestSchema>,
    "project_id" | "merge_request_iid" | "source_branch"
  >,
  mergeRequestIid?: number | string,
  branchName?: string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  if (!mergeRequestIid && !branchName) {
    throw new Error("Either mergeRequestIid or branchName must be provided");
  }

  if (branchName && !mergeRequestIid) {
    const mergeRequest = await getMergeRequest(projectId, undefined, branchName);
    mergeRequestIid = mergeRequest.iid;
  }

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestSchema.parse(await response.json());
}

/**
 * Merge a merge request
 * マージリクエストをマージする
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request
 * @param {Object} options - Options for merging the merge request
 * @returns {Promise<GitLabMergeRequest>} The merged merge request
 */
async function mergeMergeRequest(
  projectId: string,
  options: Omit<z.infer<typeof MergeMergeRequestSchema>, "project_id" | "merge_request_iid">,
  mergeRequestIid?: number | string
): Promise<GitLabMergeRequest> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}/merge`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(options),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestSchema.parse(await response.json());
}

/**
 * Approve a merge request
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string | number} mergeRequestIid - The internal ID of the merge request
 * @param {string} sha - Optional SHA to approve (for validation that MR hasn't changed)
 * @param {string} approvalPassword - Optional password for approvals requiring re-authentication
 * @returns {Promise<GitLabMergeRequestApprovalState>} The approval state after approving
 */
async function approveMergeRequest(
  projectId: string,
  mergeRequestIid: string | number,
  sha?: string,
  approvalPassword?: string
): Promise<GitLabMergeRequestApprovalState> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}/approve`
  );

  const body: Record<string, string> = {};
  if (sha) {
    body.sha = sha;
  }
  if (approvalPassword) {
    body.approval_password = approvalPassword;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestApprovalStateSchema.parse(await response.json());
}

/**
 * Unapprove a previously approved merge request
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string | number} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabMergeRequestApprovalState>} The approval state after unapproving
 */
async function unapproveMergeRequest(
  projectId: string,
  mergeRequestIid: string | number
): Promise<GitLabMergeRequestApprovalState> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}/unapprove`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({}),
  });

  await handleGitLabError(response);
  return GitLabMergeRequestApprovalStateSchema.parse(await response.json());
}

/**
 * Get the approval state of a merge request
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string | number} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabMergeRequestApprovalState>} The approval state
 */
async function getMergeRequestApprovalState(
  projectId: string,
  mergeRequestIid: string | number
): Promise<GitLabMergeRequestApprovalState> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/merge_requests/${mergeRequestIid}/approval_state`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "GET",
  });

  await handleGitLabError(response);
  return GitLabMergeRequestApprovalStateSchema.parse(await response.json());
}

/**
 * Create a new note (comment) on an issue or merge request
 * 📦 새로운 함수: createNote - 이슈 또는 병합 요청에 노트(댓글)를 추가하는 함수
 * (New function: createNote - Function to add a note (comment) to an issue or merge request)
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {"issue" | "merge_request"} noteableType - The type of the item to add a note to (issue or merge_request)
 * @param {number} noteableIid - The internal ID of the issue or merge request
 * @param {string} body - The content of the note
 * @returns {Promise<any>} The created note
 */
async function createNote(
  projectId: string,
  noteableType: "issue" | "merge_request", // 'issue' 또는 'merge_request' 타입 명시
  noteableIid: number | string,
  body: string
): Promise<any> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // ⚙️ 응답 타입은 GitLab API 문서에 따라 조정 가능
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/${noteableType}s/${noteableIid}/notes` // Using plural form (issues/merge_requests) as per GitLab API documentation
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  return await response.json();
}

/**
 * List draft notes for a merge request
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabDraftNote[]>} Array of draft notes
 */
async function getDraftNote(
  project_id: string,
  merge_request_iid: string,
  draft_note_id: string
): Promise<GitLabDraftNote> {
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(project_id)}/merge_requests/${merge_request_iid}/draft_notes/${draft_note_id}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return GitLabDraftNoteSchema.parse(data);
}

async function listDraftNotes(
  projectId: string,
  mergeRequestIid: number | string
): Promise<GitLabDraftNote[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return z.array(GitLabDraftNoteSchema).parse(data);
}

/**
 * Create a draft note for a merge request
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {string} body - The content of the draft note
 * @param {string} [inReplyToDiscussionId] - The ID of a discussion the draft note replies to
 * @param {MergeRequestThreadPosition} [position] - Position information for diff notes
 * @param {boolean} [resolveDiscussion] - Whether to resolve the discussion when publishing
 * @returns {Promise<GitLabDraftNote>} The created draft note
 */
async function createDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  body: string,
  inReplyToDiscussionId?: string,
  position?: MergeRequestThreadPosition,
  resolveDiscussion?: boolean
): Promise<GitLabDraftNote> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes`
  );

  const requestBody: any = { note: body };
  if (inReplyToDiscussionId) {
    requestBody.in_reply_to_discussion_id = inReplyToDiscussionId;
  }
  if (position) {
    requestBody.position = position;
  }
  if (resolveDiscussion !== undefined) {
    requestBody.resolve_discussion = resolveDiscussion;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return GitLabDraftNoteSchema.parse(data);
}

/**
 * Update an existing draft note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {number|string} draftNoteId - The ID of the draft note
 * @param {string} [body] - The updated content of the draft note
 * @param {MergeRequestThreadPosition} [position] - Updated position information
 * @param {boolean} [resolveDiscussion] - Whether to resolve the discussion when publishing
 * @returns {Promise<GitLabDraftNote>} The updated draft note
 */
async function updateDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  draftNoteId: number | string,
  body?: string,
  position?: MergeRequestThreadPosition,
  resolveDiscussion?: boolean
): Promise<GitLabDraftNote> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`
  );

  const requestBody: any = {};
  if (body !== undefined) {
    requestBody.note = body;
  }
  if (position) {
    requestBody.position = position;
  }
  if (resolveDiscussion !== undefined) {
    requestBody.resolve_discussion = resolveDiscussion;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return GitLabDraftNoteSchema.parse(data);
}

/**
 * Delete a draft note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {number|string} draftNoteId - The ID of the draft note
 * @returns {Promise<void>}
 */
async function deleteDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  draftNoteId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Publish a single draft note
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @param {number|string} draftNoteId - The ID of the draft note
 * @returns {Promise<GitLabDiscussionNote>} The published note
 */
async function publishDraftNote(
  projectId: string,
  mergeRequestIid: number | string,
  draftNoteId: number | string
): Promise<GitLabDiscussionNote> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}/publish`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  // Handle empty response (204 No Content) or successful response
  const responseText = await response.text();
  if (!responseText || responseText.trim() === "") {
    // Return a success indicator for empty responses
    return {
      id: draftNoteId.toString(),
      body: "Draft note published successfully",
      author: { id: "unknown", username: "unknown" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system: false,
      noteable_id: mergeRequestIid.toString(),
      noteable_type: "MergeRequest",
    } as any;
  }

  try {
    const data = JSON.parse(responseText);
    return GitLabDiscussionNoteSchema.parse(data);
  } catch (parseError) {
    // If JSON parsing fails but the operation was successful (2xx status),
    // return a success indicator
    console.warn(`JSON parse error for successful publish operation: ${parseError}`);
    return {
      id: draftNoteId.toString(),
      body: "Draft note published successfully (response parse error)",
      author: { id: "unknown", username: "unknown" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      system: false,
      noteable_id: mergeRequestIid.toString(),
      noteable_type: "MergeRequest",
    } as any;
  }
}

/**
 * Publish all draft notes for a merge request
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number|string} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabDiscussionNote[]>} Array of published notes
 */
async function bulkPublishDraftNotes(
  projectId: string,
  mergeRequestIid: number | string
): Promise<GitLabDiscussionNote[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/draft_notes/bulk_publish`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST", // Changed from PUT to POST
    body: JSON.stringify({}), // Send empty body for POST request
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  // Handle empty response (204 No Content) or successful response
  const responseText = await response.text();
  if (!responseText || responseText.trim() === "") {
    // Return empty array for successful bulk publish with no content
    return [];
  }

  try {
    const data = JSON.parse(responseText);
    return z.array(GitLabDiscussionNoteSchema).parse(data);
  } catch (parseError) {
    // If JSON parsing fails but the operation was successful (2xx status),
    // return empty array indicating successful bulk publish
    console.warn(`JSON parse error for successful bulk publish operation: ${parseError}`);
    return [];
  }
}

async function resolveMergeRequestThread(
  projectId: string,
  mergeRequestIid: number | string,
  discussionId: string,
  resolved?: boolean
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions/${discussionId}`
  );

  if (resolved !== undefined) {
    url.searchParams.append("resolved", resolved ? "true" : "false");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

/**
 * Create a new thread on a merge request
 * 📦 새로운 함수: createMergeRequestThread - 병합 요청에 새로운 스레드(토론)를 생성하는 함수
 * (New function: createMergeRequestThread - Function to create a new thread (discussion) on a merge request)
 *
 * This function provides more capabilities than createNote, including the ability to:
 * - Create diff notes (comments on specific lines of code)
 * - Specify exact positions for comments
 * - Set creation timestamps
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request
 * @param {string} body - The content of the thread
 * @param {MergeRequestThreadPosition} [position] - Position information for diff notes
 * @param {string} [createdAt] - ISO 8601 formatted creation date
 * @returns {Promise<GitLabDiscussion>} The created discussion thread
 */
async function createMergeRequestThread(
  projectId: string,
  mergeRequestIid: number | string,
  body: string,
  position?: MergeRequestThreadPosition,
  createdAt?: string
): Promise<GitLabDiscussion> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/discussions`
  );

  const payload: Record<string, any> = { body };

  if (position) {
    payload.position = position;
  }

  if (createdAt) {
    payload.created_at = createdAt;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(payload),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabDiscussionSchema.parse(data);
}

/**
 * List all versions of a merge request
 * 병합 요청의 모든 버전 목록 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request
 * @returns {Promise<GitLabMergeRequestVersion[]>} List of merge request versions
 */
async function listMergeRequestVersions(
  projectId: string,
  mergeRequestIid: number | string
): Promise<GitLabMergeRequestVersion[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/versions`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestVersionSchema).parse(data);
}

/**
 * Get a specific version of a merge request
 * 병합 요청의 특정 버전 상세 정보 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} mergeRequestIid - The internal ID of the merge request
 * @param {number} versionId - The ID of the version
 * @returns {Promise<GitLabMergeRequestVersionDetail>} The merge request version details
 */
async function getMergeRequestVersion(
  projectId: string,
  mergeRequestIid: number | string,
  versionId: number | string,
  unidiff?: boolean
): Promise<GitLabMergeRequestVersionDetail> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/merge_requests/${mergeRequestIid}/versions/${versionId}`
  );

  if (unidiff !== undefined) {
    url.searchParams.append("unidiff", String(unidiff));
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMergeRequestVersionDetailSchema.parse(data);
}

/**
 * List all namespaces
 * 사용 가능한 모든 네임스페이스 목록 조회
 *
 * @param {Object} options - Options for listing namespaces
 * @param {string} [options.search] - Search query to filter namespaces
 * @param {boolean} [options.owned_only] - Only return namespaces owned by the authenticated user
 * @param {boolean} [options.top_level_only] - Only return top-level namespaces
 * @returns {Promise<GitLabNamespace[]>} List of namespaces
 */
async function listNamespaces(options: {
  search?: string;
  owned_only?: boolean;
  top_level_only?: boolean;
}): Promise<GitLabNamespace[]> {
  const url = new URL(`${getEffectiveApiUrl()}/namespaces`);

  if (options.search) {
    url.searchParams.append("search", options.search);
  }

  if (options.owned_only) {
    url.searchParams.append("owned_only", "true");
  }

  if (options.top_level_only) {
    url.searchParams.append("top_level_only", "true");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabNamespaceSchema).parse(data);
}

/**
 * Get details on a namespace
 * 네임스페이스 상세 정보 조회
 *
 * @param {string} id - The ID or URL-encoded path of the namespace
 * @returns {Promise<GitLabNamespace>} The namespace details
 */
async function getNamespace(id: string): Promise<GitLabNamespace> {
  const url = new URL(`${getEffectiveApiUrl()}/namespaces/${encodeURIComponent(id)}`);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabNamespaceSchema.parse(data);
}

/**
 * Verify if a namespace exists
 * 네임스페이스 존재 여부 확인
 *
 * @param {string} namespacePath - The path of the namespace to check
 * @param {number} [parentId] - The ID of the parent namespace
 * @returns {Promise<GitLabNamespaceExistsResponse>} The verification result
 */
async function verifyNamespaceExistence(
  namespacePath: string,
  parentId?: number
): Promise<GitLabNamespaceExistsResponse> {
  const url = new URL(
    `${getEffectiveApiUrl()}/namespaces/${encodeURIComponent(namespacePath)}/exists`
  );

  if (parentId) {
    url.searchParams.append("parent_id", parentId.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabNamespaceExistsResponseSchema.parse(data);
}

/**
 * Get a single project
 * 단일 프로젝트 조회
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for getting project details
 * @param {boolean} [options.license] - Include project license data
 * @param {boolean} [options.statistics] - Include project statistics
 * @param {boolean} [options.with_custom_attributes] - Include custom attributes in response
 * @returns {Promise<GitLabProject>} Project details
 */
async function getProject(
  projectId: string,
  options: {
    license?: boolean;
    statistics?: boolean;
    with_custom_attributes?: boolean;
  } = {}
): Promise<GitLabProject> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}`
  );

  if (options.license) {
    url.searchParams.append("license", "true");
  }

  if (options.statistics) {
    url.searchParams.append("statistics", "true");
  }

  if (options.with_custom_attributes) {
    url.searchParams.append("with_custom_attributes", "true");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabRepositorySchema.parse(data);
}

/**
 * List projects
 * 프로젝트 목록 조회
 *
 * @param {Object} options - Options for listing projects
 * @returns {Promise<GitLabProject[]>} List of projects
 */
async function listProjects(
  options: z.infer<typeof ListProjectsSchema> = {}
): Promise<GitLabProject[]> {
  // Construct the query parameters
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) {
      if (typeof value === "boolean") {
        params.append(key, value ? "true" : "false");
      } else {
        params.append(key, String(value));
      }
    }
  }

  // Make the API request
  const response = await fetch(`${getEffectiveApiUrl()}/projects?${params.toString()}`, {
    ...getFetchConfig(),
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return z.array(GitLabProjectSchema).parse(data);
}

/**
 * List labels for a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Optional parameters for listing labels
 * @returns Array of GitLab labels
 */
async function listLabels(
  projectId: string,
  options: Omit<z.infer<typeof ListLabelsSchema>, "project_id"> = {}
): Promise<GitLabLabel[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Construct the URL with project path
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/labels`
  );

  // Add query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "boolean") {
        url.searchParams.append(key, value ? "true" : "false");
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  // Make the API request
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel[];
}

/**
 * Get a single label from a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label
 * @param includeAncestorGroups Whether to include ancestor groups
 * @returns GitLab label
 */
async function getLabel(
  projectId: string,
  labelId: number | string,
  includeAncestorGroups?: boolean
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeURIComponent(String(labelId))}`
  );

  // Add query parameters
  if (includeAncestorGroups !== undefined) {
    url.searchParams.append("include_ancestor_groups", includeAncestorGroups ? "true" : "false");
  }

  // Make the API request
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Create a new label in a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Options for creating the label
 * @returns Created GitLab label
 */
async function createLabel(
  projectId: string,
  options: Omit<z.infer<typeof CreateLabelSchema>, "project_id">
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/labels`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(options),
    }
  );

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Update an existing label in a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label to update
 * @param options Options for updating the label
 * @returns Updated GitLab label
 */
async function updateLabel(
  projectId: string,
  labelId: number | string,
  options: Omit<z.infer<typeof UpdateLabelSchema>, "project_id" | "label_id">
): Promise<GitLabLabel> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeURIComponent(String(labelId))}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(options),
    }
  );

  // Handle errors
  await handleGitLabError(response);

  // Parse and return the data
  const data = await response.json();
  return data as GitLabLabel;
}

/**
 * Delete a label from a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param labelId The ID or name of the label to delete
 */
async function deleteLabel(projectId: string, labelId: number | string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  // Make the API request
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/labels/${encodeURIComponent(String(labelId))}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );

  // Handle errors
  await handleGitLabError(response);
}

/**
 * List all projects in a GitLab group
 *
 * @param {z.infer<typeof ListGroupProjectsSchema>} options - Options for listing group projects
 * @returns {Promise<GitLabProject[]>} Array of projects in the group
 */
async function listGroupProjects(
  options: z.infer<typeof ListGroupProjectsSchema>
): Promise<GitLabProject[]> {
  const url = new URL(
    `${getEffectiveApiUrl()}/groups/${encodeURIComponent(options.group_id)}/projects`
  );

  // Add optional parameters to URL
  if (options.include_subgroups) url.searchParams.append("include_subgroups", "true");
  if (options.search) url.searchParams.append("search", options.search);
  if (options.order_by) url.searchParams.append("order_by", options.order_by);
  if (options.sort) url.searchParams.append("sort", options.sort);
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.archived !== undefined)
    url.searchParams.append("archived", options.archived.toString());
  if (options.visibility) url.searchParams.append("visibility", options.visibility);
  if (options.with_issues_enabled !== undefined)
    url.searchParams.append("with_issues_enabled", options.with_issues_enabled.toString());
  if (options.with_merge_requests_enabled !== undefined)
    url.searchParams.append(
      "with_merge_requests_enabled",
      options.with_merge_requests_enabled.toString()
    );
  if (options.min_access_level !== undefined)
    url.searchParams.append("min_access_level", options.min_access_level.toString());
  if (options.with_programming_language)
    url.searchParams.append("with_programming_language", options.with_programming_language);
  if (options.starred !== undefined) url.searchParams.append("starred", options.starred.toString());
  if (options.statistics !== undefined)
    url.searchParams.append("statistics", options.statistics.toString());
  if (options.with_custom_attributes !== undefined)
    url.searchParams.append("with_custom_attributes", options.with_custom_attributes.toString());
  if (options.with_security_reports !== undefined)
    url.searchParams.append("with_security_reports", options.with_security_reports.toString());

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const projects = await response.json();
  return GitLabProjectSchema.array().parse(projects);
}

// Wiki API helper functions
/**
 * List wiki pages in a project
 */
async function listWikiPages(
  projectId: string,
  options: Omit<ListWikiPagesOptions, "project_id"> = {}
): Promise<GitLabWikiPage[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis`
  );
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.with_content)
    url.searchParams.append("with_content", options.with_content.toString());
  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.array().parse(data);
}

/**
 * Get a specific wiki page
 */
async function getWikiPage(projectId: string, slug: string): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
    { ...getFetchConfig() }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Create a new wiki page
 */
async function createWikiPage(
  projectId: string,
  title: string,
  content: string,
  format?: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const body: Record<string, any> = { title, content };
  if (format) body.format = format;
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Update an existing wiki page
 */
async function updateWikiPage(
  projectId: string,
  slug: string,
  title?: string,
  content?: string,
  format?: string
): Promise<GitLabWikiPage> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const body: Record<string, any> = {};
  if (title) body.title = title;
  if (content) body.content = content;
  if (format) body.format = format;
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabWikiPageSchema.parse(data);
}

/**
 * Delete a wiki page
 */
async function deleteWikiPage(projectId: string, slug: string): Promise<void> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/wikis/${encodeURIComponent(slug)}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );
  await handleGitLabError(response);
}

/**
 * List pipelines in a GitLab project
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {ListPipelinesOptions} options - Options for filtering pipelines
 * @returns {Promise<GitLabPipeline[]>} List of pipelines
 */
async function listPipelines(
  projectId: string,
  options: Omit<ListPipelinesOptions, "project_id"> = {}
): Promise<GitLabPipeline[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabPipelineSchema).parse(data);
}

/**
 * Get details of a specific pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline
 * @returns {Promise<GitLabPipeline>} Pipeline details
 */
async function getPipeline(
  projectId: string,
  pipelineId: number | string
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  if (response.status === 404) {
    throw new Error(`Pipeline not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * List all jobs in a specific pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline
 * @param {Object} options - Options for filtering jobs
 * @returns {Promise<GitLabPipelineJob[]>} List of pipeline jobs
 */
async function listPipelineJobs(
  projectId: string,
  pipelineId: number | string,
  options: Omit<ListPipelineJobsOptions, "project_id" | "pipeline_id"> = {}
): Promise<GitLabPipelineJob[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/jobs`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "boolean") {
        url.searchParams.append(key, value ? "true" : "false");
      } else {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  if (response.status === 404) {
    throw new Error(`Pipeline not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabPipelineJobSchema).parse(data);
}

/**
 * List all trigger jobs (bridges) in a specific pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline
 * @param {Object} options - Options for filtering trigger jobs
 * @returns {Promise<GitLabPipelineTriggerJob[]>} List of pipeline trigger jobs
 */
async function listPipelineTriggerJobs(
  projectId: string,
  pipelineId: number | string,
  options: Omit<ListPipelineTriggerJobsOptions, "project_id" | "pipeline_id"> = {}
): Promise<GitLabPipelineTriggerJob[]> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/bridges`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === "boolean") {
        url.searchParams.append(key, value ? "true" : "false");
      } else {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  if (response.status === 404) {
    throw new Error(`Pipeline not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabPipelineTriggerJobSchema).parse(data);
}

async function getPipelineJob(
  projectId: string,
  jobId: number | string
): Promise<GitLabPipelineJob> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  if (response.status === 404) {
    throw new Error(`Job not found`);
  }

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineJobSchema.parse(data);
}

/**
 * Get the output/trace of a pipeline job
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} jobId - The ID of the job
 * @param {number} limit - Maximum number of lines to return from the end (default: 1000)
 * @param {number} offset - Number of lines to skip from the end (default: 0)
 * @returns {Promise<string>} The job output/trace
 */
async function getPipelineJobOutput(
  projectId: string,
  jobId: number | string,
  limit?: number,
  offset?: number
): Promise<string> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}/trace`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
      Accept: "text/plain", // Override Accept header to get plain text
    },
  });

  if (response.status === 404) {
    throw new Error(`Job trace not found or job is not finished yet`);
  }

  await handleGitLabError(response);
  const fullTrace = await response.text();

  // Apply client-side pagination to limit context window usage
  if (limit !== undefined || offset !== undefined) {
    const lines = fullTrace.split("\n");
    const startOffset = offset || 0;
    const maxLines = limit || 1000;

    // Return lines from the end, skipping offset lines and limiting to maxLines
    const startIndex = Math.max(0, lines.length - startOffset - maxLines);
    const endIndex = lines.length - startOffset;

    const selectedLines = lines.slice(startIndex, endIndex);
    const result = selectedLines.join("\n");

    // Add metadata about truncation
    if (startIndex > 0 || endIndex < lines.length) {
      const totalLines = lines.length;
      const shownLines = selectedLines.length;
      const skippedFromStart = startIndex;
      const skippedFromEnd = startOffset;

      return `[Log truncated: showing ${shownLines} of ${totalLines} lines, skipped ${skippedFromStart} from start, ${skippedFromEnd} from end]\n\n${result}`;
    }

    return result;
  }

  return fullTrace;
}

/**
 * Create a new pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} ref - The branch or tag to run the pipeline on
 * @param {Array} variables - Optional variables for the pipeline
 * @returns {Promise<GitLabPipeline>} The created pipeline
 */
async function createPipeline(
  projectId: string,
  ref: string,
  variables?: Array<{ key: string; value: string }>
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipeline`
  );

  const body: any = { ref };
  if (variables && variables.length > 0) {
    body.variables = variables;
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * Retry a pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline to retry
 * @returns {Promise<GitLabPipeline>} The retried pipeline
 */
async function retryPipeline(
  projectId: string,
  pipelineId: number | string
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/retry`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
    },
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * Cancel a pipeline
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} pipelineId - The ID of the pipeline to cancel
 * @returns {Promise<GitLabPipeline>} The canceled pipeline
 */
async function cancelPipeline(
  projectId: string,
  pipelineId: number | string
): Promise<GitLabPipeline> {
  projectId = decodeURIComponent(projectId); // Decode project ID
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/pipelines/${pipelineId}/cancel`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
    },
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineSchema.parse(data);
}

/**
 * Run a manual job
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} jobId - The ID of the job to run
 * @param {Object} variables - Optional job variables
 * @returns {Promise<GitLabPipelineJob>} The run job
 */
async function playPipelineJob(
  projectId: string,
  jobId: number | string,
  variables?: Array<{ key: string; value: string }>
): Promise<GitLabPipelineJob> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}/play`
  );

  const body: any = {};
  if (variables && variables.length > 0) {
    body.job_variables_attributes = variables;
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineJobSchema.parse(data);
}

/**
 * Retry a job
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} jobId - The ID of the job to retry
 * @returns {Promise<GitLabPipelineJob>} The retried job
 */
async function retryPipelineJob(
  projectId: string,
  jobId: number | string
): Promise<GitLabPipelineJob> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}/retry`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineJobSchema.parse(data);
}

/**
 * Cancel a job
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} jobId - The ID of the job to cancel
 * @param {boolean} force - Force cancellation of the job
 * @returns {Promise<GitLabPipelineJob>} The canceled job
 */
async function cancelPipelineJob(
  projectId: string,
  jobId: number | string,
  force?: boolean
): Promise<GitLabPipelineJob> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/jobs/${jobId}/cancel`
  );

  if (force !== undefined) {
    url.searchParams.append("force", force.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
  });

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabPipelineJobSchema.parse(data);
}

/**
 * Get the repository tree for a project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {GetRepositoryTreeOptions} options - Options for the tree
 * @returns {Promise<GitLabTreeItem[]>}
 */
async function getRepositoryTree(options: GetRepositoryTreeOptions): Promise<GitLabTreeItem[]> {
  options.project_id = decodeURIComponent(options.project_id); // Decode project_id within options
  const queryParams = new URLSearchParams();
  if (options.path) queryParams.append("path", options.path);
  if (options.ref) queryParams.append("ref", options.ref);
  if (options.recursive) queryParams.append("recursive", "true");
  if (options.per_page) queryParams.append("per_page", options.per_page.toString());
  if (options.page_token) queryParams.append("page_token", options.page_token);
  if (options.pagination) queryParams.append("pagination", options.pagination);

  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    ...buildAuthHeaders(),
  };
  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(options.project_id)
    )}/repository/tree?${queryParams.toString()}`,
    {
      headers,
    }
  );

  if (response.status === 404) {
    throw new Error("Repository or path not found");
  }

  if (!response.ok) {
    throw new Error(`Failed to get repository tree: ${response.statusText}`);
  }

  const data = await response.json();
  return z.array(GitLabTreeItemSchema).parse(data);
}

/**
 * List project milestones in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for listing milestones
 * @returns {Promise<GitLabMilestones[]>} List of milestones
 */
async function listProjectMilestones(
  projectId: string,
  options: Omit<z.infer<typeof ListProjectMilestonesSchema>, "project_id">
): Promise<GitLabMilestones[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones`
  );

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "iids" && Array.isArray(value) && value.length > 0) {
        value.forEach(iid => {
          url.searchParams.append("iids[]", iid.toString());
        });
      } else if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMilestonesSchema).parse(data);
}

/**
 * Get a single milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMilestones>} Milestone details
 */
async function getProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Create a new milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {Object} options - Options for creating a milestone
 * @returns {Promise<GitLabMilestones>} Created milestone
 */
async function createProjectMilestone(
  projectId: string,
  options: Omit<z.infer<typeof CreateProjectMilestoneSchema>, "project_id">
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Edit an existing milestone in a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @param {Object} options - Options for editing a milestone
 * @returns {Promise<GitLabMilestones>} Updated milestone
 */
async function editProjectMilestone(
  projectId: string,
  milestoneId: number | string,
  options: Omit<z.infer<typeof EditProjectMilestoneSchema>, "project_id" | "milestone_id">
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "PUT",
    body: JSON.stringify(options),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Delete a milestone from a GitLab project
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<void>}
 */
async function deleteProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<void> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "DELETE",
  });
  await handleGitLabError(response);
}

/**
 * Get all issues assigned to a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabIssue[]>} List of issues
 */
async function getMilestoneIssues(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabIssue[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}/issues`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabIssueSchema).parse(data);
}

/**
 * Get all merge requests assigned to a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMergeRequest[]>} List of merge requests
 */
async function getMilestoneMergeRequests(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMergeRequest[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/milestones/${milestoneId}/merge_requests`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabMergeRequestSchema).parse(data);
}

/**
 * Promote a project milestone to a group milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<GitLabMilestones>} Promoted milestone
 */
async function promoteProjectMilestone(
  projectId: string,
  milestoneId: number | string
): Promise<GitLabMilestones> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/milestones/${milestoneId}/promote`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
  });
  await handleGitLabError(response);
  const data = await response.json();
  return GitLabMilestonesSchema.parse(data);
}

/**
 * Get all burndown chart events for a single milestone
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {number} milestoneId - The ID of the milestone
 * @returns {Promise<any[]>} Burndown chart events
 */
async function getMilestoneBurndownEvents(
  projectId: string,
  milestoneId: number | string
): Promise<any[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(
      getEffectiveProjectId(projectId)
    )}/milestones/${milestoneId}/burndown_events`
  );

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });
  await handleGitLabError(response);
  const data = await response.json();
  return data as any[];
}

/**
 * Get a single user from GitLab
 *
 * @param {string} username - The username to look up
 * @returns {Promise<GitLabUser | null>} The user data or null if not found
 */
async function getUser(username: string): Promise<GitLabUser | null> {
  try {
    const url = new URL(`${getEffectiveApiUrl()}/users`);
    url.searchParams.append("username", username);

    const response = await fetch(url.toString(), {
      ...getFetchConfig(),
    });

    await handleGitLabError(response);

    const users = await response.json();

    // GitLab returns an array of users that match the username
    if (Array.isArray(users) && users.length > 0) {
      // Find exact match for username (case-sensitive)
      const exactMatch = users.find(user => user.username === username);
      if (exactMatch) {
        return GitLabUserSchema.parse(exactMatch);
      }
    }

    // No matching user found
    return null;
  } catch (error) {
    logger.error(`Error fetching user by username '${username}':`, error);
    return null;
  }
}

/**
 * Get multiple users from GitLab
 *
 * @param {string[]} usernames - Array of usernames to look up
 * @returns {Promise<GitLabUsersResponse>} Object with usernames as keys and user objects or null as values
 */
async function getUsers(usernames: string[]): Promise<GitLabUsersResponse> {
  const users: Record<string, GitLabUser | null> = {};

  // Process usernames sequentially to avoid rate limiting
  for (const username of usernames) {
    try {
      const user = await getUser(username);
      users[username] = user;
    } catch (error) {
      logger.error(`Error processing username '${username}':`, error);
      users[username] = null;
    }
  }

  return GitLabUsersResponseSchema.parse(users);
}

/**
 * List repository commits
 * 저장소 커밋 목록 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {ListCommitsOptions} options - List commits options
 * @returns {Promise<GitLabCommit[]>} List of commits
 */
async function listCommits(
  projectId: string,
  options: Omit<ListCommitsOptions, "project_id"> = {}
): Promise<GitLabCommit[]> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits`
  );

  // Add query parameters
  if (options.ref_name) url.searchParams.append("ref_name", options.ref_name);
  if (options.since) url.searchParams.append("since", options.since);
  if (options.until) url.searchParams.append("until", options.until);
  if (options.path) url.searchParams.append("path", options.path);
  if (options.author) url.searchParams.append("author", options.author);
  if (options.all) url.searchParams.append("all", options.all.toString());
  if (options.with_stats) url.searchParams.append("with_stats", options.with_stats.toString());
  if (options.first_parent)
    url.searchParams.append("first_parent", options.first_parent.toString());
  if (options.order) url.searchParams.append("order", options.order);
  if (options.trailers) url.searchParams.append("trailers", options.trailers.toString());
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return z.array(GitLabCommitSchema).parse(data);
}

/**
 * Get a single commit
 * 단일 커밋 정보 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {string} sha - The commit hash or name of a repository branch or tag
 * @param {boolean} [stats] - Include commit stats
 * @returns {Promise<GitLabCommit>} The commit details
 */
async function getCommit(projectId: string, sha: string, stats?: boolean): Promise<GitLabCommit> {
  projectId = decodeURIComponent(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits/${encodeURIComponent(sha)}`
  );

  if (stats) {
    url.searchParams.append("stats", "true");
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabCommitSchema.parse(data);
}

/**
 * Get commit diff
 * 커밋 변경사항 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {string} sha - The commit hash or name of a repository branch or tag
 * @param {boolean} [full_diff] - Whether to return the full diff or only first page
 * @returns {Promise<GitLabMergeRequestDiff[]>} The commit diffs
 */
async function getCommitDiff(
  projectId: string,
  sha: string,
  full_diff?: boolean
): Promise<GitLabMergeRequestDiff[]> {
  projectId = decodeURIComponent(projectId);
  const baseUrl = `${getEffectiveApiUrl()}/projects/${encodeURIComponent(getEffectiveProjectId(projectId))}/repository/commits/${encodeURIComponent(sha)}/diff`;

  let allDiffs: GitLabMergeRequestDiff[] = [];
  let page = 1;

  while (true) {
    const url = new URL(baseUrl);

    if (full_diff) {
      url.searchParams.append("page", page.toString());
    }

    const response = await fetch(url.toString(), {
      ...getFetchConfig(),
    });

    await handleGitLabError(response);

    const data = await response.json();
    const diffs = z.array(GitLabDiffSchema).parse(data);

    allDiffs.push(...diffs);

    if (!full_diff) {
      break;
    }

    if (diffs.length < GITLAB_COMMIT_FILES_PER_PAGE) {
      break;
    }

    page++;
  }

  return allDiffs;
}

/**
 * Get the current authenticated user
 * 현재 인증된 사용자 가져오기
 *
 * @returns {Promise<GitLabUser>} The current user
 */
async function getCurrentUser(): Promise<GitLabUser> {
  const response = await fetch(`${getEffectiveApiUrl()}/user`, getFetchConfig());

  await handleGitLabError(response);
  const data = await response.json();
  return GitLabUserSchema.parse(data);
}

/**
 * List issues assigned to the current authenticated user
 * 현재 인증된 사용자에게 할당된 이슈 목록 조회
 *
 * @param {MyIssuesOptions} options - Options for filtering issues
 * @returns {Promise<GitLabIssue[]>} List of issues assigned to the current user
 */
async function myIssues(options: MyIssuesOptions = {}): Promise<GitLabIssue[]> {
  // Get current user to find their username
  const currentUser = await getCurrentUser();

  // Use getEffectiveProjectId to handle project ID resolution
  const effectiveProjectId = getEffectiveProjectId(options.project_id || "");

  // Use listIssues with assignee_username filter
  let listIssuesOptions: Omit<z.infer<typeof ListIssuesSchema>, "project_id"> = {
    state: options.state || "opened", // Default to "opened" if not specified
    labels: options.labels,
    milestone: options.milestone,
    search: options.search,
    created_after: options.created_after,
    created_before: options.created_before,
    updated_after: options.updated_after,
    updated_before: options.updated_before,
    per_page: options.per_page,
    page: options.page,
  };

  if (currentUser.username) {
    listIssuesOptions.assignee_username = [currentUser.username];
  } else {
    listIssuesOptions.assignee_id = currentUser.id;
  }
  return listIssues(effectiveProjectId, listIssuesOptions);
}

/**
 * List members of a GitLab project
 * GitLab 프로젝트 멤버 목록 조회
 *
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {Omit<ListProjectMembersOptions, "project_id">} options - Options for filtering members
 * @returns {Promise<GitLabProjectMember[]>} List of project members
 */
async function listProjectMembers(
  projectId: string,
  options: Omit<ListProjectMembersOptions, "project_id"> = {}
): Promise<GitLabProjectMember[]> {
  projectId = decodeURIComponent(projectId);
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const membersPath = options.include_inheritance ? "members/all" : "members";
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/${membersPath}`
  );

  // Add query parameters
  if (options.query) url.searchParams.append("query", options.query);
  if (options.user_ids) {
    options.user_ids.forEach(id => url.searchParams.append("user_ids[]", id.toString()));
  }
  if (options.skip_users) {
    options.skip_users.forEach(id => url.searchParams.append("skip_users[]", id.toString()));
  }
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());
  if (options.page) url.searchParams.append("page", options.page.toString());

  const response = await fetch(url.toString(), getFetchConfig());

  await handleGitLabError(response);
  const data = await response.json();
  return z.array(GitLabProjectMemberSchema).parse(data);
}

/**
 * list group iterations
 *
 * @param {string} groupId
 * @param {Omit<ListGroupIterationsOptions, "group_id">} options
 * @returns {Promise<GetIt[]>}
 */
async function listGroupIterations(
  groupId: string,
  options: Omit<z.infer<typeof ListGroupIterationsSchema>, "group_id"> = {}
): Promise<GroupIteration[]> {
  groupId = decodeURIComponent(groupId);
  const url = new URL(`${getEffectiveApiUrl()}/groups/${encodeURIComponent(groupId)}/iterations`);

  // クエリパラメータの追加
  if (options.state) url.searchParams.append("state", options.state);
  if (options.search) url.searchParams.append("search", options.search);
  if (options.search_in) url.searchParams.append("in", options.search_in.join(","));
  if (options.include_ancestors !== undefined)
    url.searchParams.append("include_ancestors", options.include_ancestors.toString());
  if (options.include_descendants !== undefined)
    url.searchParams.append("include_descendants", options.include_descendants.toString());
  if (options.updated_before) url.searchParams.append("updated_before", options.updated_before);
  if (options.updated_after) url.searchParams.append("updated_after", options.updated_after);
  if (options.page) url.searchParams.append("page", options.page.toString());
  if (options.per_page) url.searchParams.append("per_page", options.per_page.toString());

  const response = await fetch(url.toString(), getFetchConfig());

  if (!response.ok) {
    await handleGitLabError(response);
  }

  const data = await response.json();
  return z.array(GroupIteration).parse(data);
}

/**
 * Upload a file to a GitLab project for use in markdown content
 *
 * @param {string} projectId - The ID or URL-encoded path of the project
 * @param {string} filePath - Path to the local file to upload
 * @returns {Promise<GitLabMarkdownUpload>} The upload response
 */
async function markdownUpload(projectId: string, filePath: string): Promise<GitLabMarkdownUpload> {
  projectId = decodeURIComponent(projectId);
  const effectiveProjectId = getEffectiveProjectId(projectId);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read the file
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Create form data
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: fileName,
    contentType: "application/octet-stream",
  });

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/uploads`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
      // Remove Content-Type header to let form-data set it with boundary
      "Content-Type": undefined as any,
    },
    body: form,
  });

  if (!response.ok) {
    await handleGitLabError(response);
  }

  const data = await response.json();
  return GitLabMarkdownUploadSchema.parse(data);
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function getImageMimeType(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_MIME_TYPES[ext] ?? null;
}

interface DownloadAttachmentResult {
  buffer: Buffer;
  filename: string;
  mimeType: string | null;
  savedPath?: string;
}

async function downloadAttachment(
  projectId: string,
  secret: string,
  filename: string,
  localPath?: string
): Promise<DownloadAttachmentResult> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/uploads/${secret}/${filename}`
  );

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
    },
  });

  if (!response.ok) {
    await handleGitLabError(response);
  }

  // Get the file content as buffer
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = getImageMimeType(filename);

  // For non-image files, always save to disk.
  // For image files, only save to disk if local_path is explicitly provided.
  if (!mimeType || localPath) {
    let savePath: string;
    if (localPath) {
      const normalizedLocalPath = path.normalize(localPath);
      if (
        path.isAbsolute(normalizedLocalPath) ||
        normalizedLocalPath === ".." ||
        normalizedLocalPath.startsWith(".." + path.sep) ||
        normalizedLocalPath.includes(path.sep + ".." + path.sep)
      ) {
        throw new Error("Invalid local_path: directory traversal is not allowed.");
      }
      savePath = path.join(normalizedLocalPath, filename);
    } else {
      savePath = filename;
    }
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(savePath, buffer);
    return { buffer, filename, mimeType, savedPath: savePath };
  }

  return { buffer, filename, mimeType };
}

/**
 * List all events for the currently authenticated user
 * @param {Object} options - Options for listing events
 * @returns {Promise<GitLabEvent[]>} List of events
 */
async function listEvents(options: z.infer<typeof ListEventsSchema> = {}): Promise<GitLabEvent[]> {
  const url = new URL(`${getEffectiveApiUrl()}/events`);

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
    },
  });

  if (!response.ok) {
    await handleGitLabError(response);
  }

  const data = await response.json();
  return GitLabEventSchema.array().parse(data);
}

/**
 * List all visible events for a specified project
 * @param {string} projectId - Project ID or URL-encoded path
 * @param {Object} options - Options for getting project events
 * @returns {Promise<GitLabEvent[]>} List of project events
 */
async function getProjectEvents(
  projectId: string,
  options: Omit<z.infer<typeof GetProjectEventsSchema>, "project_id"> = {}
): Promise<GitLabEvent[]> {
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/events`
  );

  // Add all query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...BASE_HEADERS,
      ...buildAuthHeaders(),
    },
  });

  if (!response.ok) {
    await handleGitLabError(response);
  }

  const data = await response.json();
  return GitLabEventSchema.array().parse(data);
}

/**
 * List all releases for a project
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Optional parameters for listing releases
 * @returns Array of GitLab releases
 */
async function listReleases(
  projectId: string,
  options: Omit<z.infer<typeof ListReleasesSchema>, "project_id"> = {}
): Promise<GitLabRelease[]> {
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases`
  );

  // Add query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.array().parse(data);
}

/**
 * Get a release by tag name
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @param includeHtmlDescription If true, includes HTML rendered Markdown
 * @returns GitLab release
 */
async function getRelease(
  projectId: string,
  tagName: string,
  includeHtmlDescription?: boolean
): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);
  const url = new URL(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases/${encodeURIComponent(tagName)}`
  );

  if (includeHtmlDescription !== undefined) {
    url.searchParams.append("include_html_description", includeHtmlDescription.toString());
  }

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Create a new release
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param options Options for creating the release
 * @returns Created GitLab release
 */
async function createRelease(
  projectId: string,
  options: Omit<z.infer<typeof CreateReleaseSchema>, "project_id">
): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases`,
    {
      ...getFetchConfig(),
      method: "POST",
      body: JSON.stringify(options),
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Update an existing release
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @param options Options for updating the release
 * @returns Updated GitLab release
 */
async function updateRelease(
  projectId: string,
  tagName: string,
  options: Omit<z.infer<typeof UpdateReleaseSchema>, "project_id" | "tag_name">
): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases/${encodeURIComponent(tagName)}`,
    {
      ...getFetchConfig(),
      method: "PUT",
      body: JSON.stringify(options),
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Delete a release
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @returns Deleted GitLab release
 */
async function deleteRelease(projectId: string, tagName: string): Promise<GitLabRelease> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases/${encodeURIComponent(tagName)}`,
    {
      ...getFetchConfig(),
      method: "DELETE",
    }
  );

  await handleGitLabError(response);

  const data = await response.json();
  return GitLabReleaseSchema.parse(data);
}

/**
 * Create release evidence (GitLab Premium/Ultimate only)
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 */
async function createReleaseEvidence(projectId: string, tagName: string): Promise<void> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases/${encodeURIComponent(tagName)}/evidence`,
    {
      ...getFetchConfig(),
      method: "POST",
    }
  );

  await handleGitLabError(response);
}

/**
 * Download a release asset
 *
 * @param projectId The ID or URL-encoded path of the project
 * @param tagName The Git tag the release is associated with
 * @param directAssetPath Path to the release asset file
 * @returns The asset file content
 */
async function downloadReleaseAsset(
  projectId: string,
  tagName: string,
  directAssetPath: string
): Promise<string> {
  const effectiveProjectId = getEffectiveProjectId(projectId);

  const response = await fetch(
    `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}/releases/${encodeURIComponent(tagName)}/downloads/${directAssetPath}`,
    {
      ...getFetchConfig(),
    }
  );

  await handleGitLabError(response);

  return await response.text();
}

// Request handlers are now registered inside createServer() factory function
// to ensure each transport connection gets its own Server instance (GHSA-345p-7cg4-v4c7).

/**
 * Filter diffs by excluded file patterns
 * Safely handles invalid regex patterns by logging and ignoring them
 *
 * @param diffs - Array of diff objects with new_path property
 * @param excludedFilePatterns - Array of regex patterns to exclude
 * @returns Filtered array of diffs
 */
function filterDiffsByPatterns<T extends { new_path: string }>(
  diffs: T[],
  excludedFilePatterns: string[] | undefined
): T[] {
  if (!excludedFilePatterns?.length) return diffs;

  const regexPatterns = excludedFilePatterns
    .map(pattern => {
      try {
        return new RegExp(pattern);
      } catch (e) {
        console.warn(`Invalid regex pattern ignored: ${pattern}`);
        return null;
      }
    })
    .filter((regex): regex is RegExp => regex !== null);

  if (regexPatterns.length === 0) return diffs;

  const matchesAnyPattern = (path: string): boolean => {
    if (!path) return false;
    return regexPatterns.some(regex => regex.test(path));
  };

  return diffs.filter(diff => !matchesAnyPattern(diff.new_path));
}

async function handleToolCall(params: any) {
  try {
    if (!params.arguments) {
      throw new Error("Arguments are required");
    }

    // Ensure session is established for every request if cookie authentication is enabled
    if (GITLAB_AUTH_COOKIE_PATH) {
      await ensureSessionForRequest();
    }
    logger.info(params.name);
    switch (params.name) {
      case "execute_graphql": {
        const args = ExecuteGraphQLSchema.parse(params.arguments);
        const apiUrl = new URL(getEffectiveApiUrl());
        // Build GraphQL endpoint preserving any instance subpath (e.g. /gitlab)
        const restPath = apiUrl.pathname || ""; // e.g. /api/v4 or /gitlab/api/v4
        const idx = restPath.lastIndexOf("/api/v4");
        const prefix = idx >= 0 ? restPath.slice(0, idx) : "";
        const graphqlUrl =
          process.env.GITLAB_GRAPHQL_URL || `${apiUrl.origin}${prefix}/api/graphql`;

        // Add timeout to avoid hanging requests
        const controller = new AbortController();
        const timeoutMs = 45000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        logger.info({ endpoint: graphqlUrl }, "execute_graphql request");
        try {
          const response = await fetch(graphqlUrl, {
            ...getFetchConfig(),
            method: "POST",
            headers: {
              ...BASE_HEADERS,
              ...buildAuthHeaders(),
            },
            body: JSON.stringify({ query: args.query, variables: args.variables || {} }),
            signal: controller.signal as any,
          });
          if (!response.ok) {
            await handleGitLabError(response);
          }
          const json = await response.json();
          return {
            content: [{ type: "text", text: JSON.stringify(json, null, 2) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `GraphQL request failed: ${message}` }, null, 2),
              },
            ],
          };
        } finally {
          clearTimeout(timeout);
        }
      }
      case "fork_repository": {
        if (GITLAB_PROJECT_ID) {
          throw new Error("Direct project ID is set. So fork_repository is not allowed");
        }
        const forkArgs = ForkRepositorySchema.parse(params.arguments);
        try {
          const forkedProject = await forkProject(forkArgs.project_id, forkArgs.namespace);
          return {
            content: [{ type: "text", text: JSON.stringify(forkedProject, null, 2) }],
          };
        } catch (forkError) {
          logger.error("Error forking repository:", forkError);
          let forkErrorMessage = "Failed to fork repository";
          if (forkError instanceof Error) {
            forkErrorMessage = `${forkErrorMessage}: ${forkError.message}`;
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: forkErrorMessage }, null, 2),
              },
            ],
          };
        }
      }

      case "create_branch": {
        const args = CreateBranchSchema.parse(params.arguments);
        let ref = args.ref;
        if (!ref) {
          ref = await getDefaultBranchRef(args.project_id);
        }

        const branch = await createBranch(args.project_id, {
          name: args.branch,
          ref,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
        };
      }

      case "get_branch_diffs": {
        const args = GetBranchDiffsSchema.parse(params.arguments);
        const diffResp = await getBranchDiffs(args.project_id, args.from, args.to, args.straight);
        diffResp.diffs = filterDiffsByPatterns(diffResp.diffs, args.excluded_file_patterns);
        return {
          content: [{ type: "text", text: JSON.stringify(diffResp, null, 2) }],
        };
      }

      case "search_repositories": {
        const args = SearchRepositoriesSchema.parse(params.arguments);
        const results = await searchProjects(args.search, args.page, args.per_page);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "create_repository": {
        if (GITLAB_PROJECT_ID) {
          throw new Error("Direct project ID is set. So fork_repository is not allowed");
        }
        const args = CreateRepositorySchema.parse(params.arguments);
        const repository = await createRepository(args);
        return {
          content: [{ type: "text", text: JSON.stringify(repository, null, 2) }],
        };
      }

      case "get_file_contents": {
        const args = GetFileContentsSchema.parse(params.arguments);
        const contents = await getFileContents(args.project_id, args.file_path, args.ref);
        return {
          content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
        };
      }

      case "create_or_update_file": {
        const args = CreateOrUpdateFileSchema.parse(params.arguments);
        const result = await createOrUpdateFile(
          args.project_id,
          args.file_path,
          args.content,
          args.commit_message,
          args.branch,
          args.previous_path,
          args.last_commit_id,
          args.commit_id
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "push_files": {
        const args = PushFilesSchema.parse(params.arguments);
        const result = await createCommit(
          args.project_id,
          args.commit_message,
          args.branch,
          args.files.map(f => ({ path: f.file_path, content: f.content }))
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_issue": {
        const args = CreateIssueSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const issue = await createIssue(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "create_merge_request": {
        const args = CreateMergeRequestSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const mergeRequest = await createMergeRequest(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "delete_merge_request_discussion_note": {
        const args = DeleteMergeRequestDiscussionNoteSchema.parse(params.arguments);
        const { project_id, merge_request_iid, discussion_id, note_id } = args;
        await deleteMergeRequestDiscussionNote(
          project_id,
          merge_request_iid,
          discussion_id,
          note_id
        );

        return {
          content: [{ type: "text", text: "Merge request discussion note deleted successfully" }],
        };
      }

      case "update_merge_request_discussion_note": {
        const args = UpdateMergeRequestDiscussionNoteSchema.parse(params.arguments);
        const note = await updateMergeRequestDiscussionNote(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.note_id,
          args.body, // Now optional
          args.resolved // Now one of body or resolved must be provided, not both
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_merge_request_discussion_note": {
        const args = CreateMergeRequestDiscussionNoteSchema.parse(params.arguments);
        const note = await createMergeRequestDiscussionNote(
          args.project_id,
          args.merge_request_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_merge_request_note": {
        const args = CreateMergeRequestNoteSchema.parse(params.arguments);
        const note = await createMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.body
        );

        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "delete_merge_request_note": {
        const args = DeleteMergeRequestNoteSchema.parse(params.arguments);
        await deleteMergeRequestNote(args.project_id, args.merge_request_iid, args.note_id);

        return {
          content: [{ type: "text", text: "Merge request note deleted successfully" }],
        };
      }

      case "get_merge_request_note": {
        const args = GetMergeRequestNoteSchema.parse(params.arguments);
        const note = await getMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.note_id
        );

        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "get_merge_request_notes": {
        const args = GetMergeRequestNotesSchema.parse(params.arguments);
        const notes = await getMergeRequestNotes(
          args.project_id,
          args.merge_request_iid,
          args.sort,
          args.order_by,
          args.per_page,
          args.page
        );

        return {
          content: [{ type: "text", text: JSON.stringify(notes, null, 2) }],
        };
      }

      case "update_merge_request_note": {
        const args = UpdateMergeRequestNoteSchema.parse(params.arguments);
        const note = await updateMergeRequestNote(
          args.project_id,
          args.merge_request_iid,
          args.note_id,
          args.body
        );

        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "update_issue_note": {
        const args = UpdateIssueNoteSchema.parse(params.arguments);
        const note = await updateIssueNote(
          args.project_id,
          args.issue_iid,
          args.discussion_id,
          args.note_id,
          args.body,
          args.resolved
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "create_issue_note": {
        const args = CreateIssueNoteSchema.parse(params.arguments);
        const note = await createIssueNote(
          args.project_id,
          args.issue_iid,
          args.discussion_id,
          args.body,
          args.created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "get_merge_request": {
        const args = GetMergeRequestSchema.parse(params.arguments);
        const mergeRequest = await getMergeRequest(
          args.project_id,
          args.merge_request_iid,
          args.source_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "get_merge_request_diffs": {
        const args = GetMergeRequestDiffsSchema.parse(params.arguments);
        const diffs = await getMergeRequestDiffs(
          args.project_id,
          args.merge_request_iid,
          args.source_branch,
          args.view
        );
        const filteredDiffs = filterDiffsByPatterns(diffs, args.excluded_file_patterns);
        return {
          content: [{ type: "text", text: JSON.stringify(filteredDiffs, null, 2) }],
        };
      }

      case "list_merge_request_diffs": {
        const args = ListMergeRequestDiffsSchema.parse(params.arguments);
        const changes = await listMergeRequestDiffs(
          args.project_id,
          args.merge_request_iid,
          args.source_branch,
          args.page,
          args.per_page,
          args.unidiff
        );
        return {
          content: [{ type: "text", text: JSON.stringify(changes, null, 2) }],
        };
      }

      case "list_merge_request_versions": {
        const args = ListMergeRequestVersionsSchema.parse(params.arguments);
        const versions = await listMergeRequestVersions(args.project_id, args.merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(versions, null, 2) }],
        };
      }

      case "get_merge_request_version": {
        const args = GetMergeRequestVersionSchema.parse(params.arguments);
        const version = await getMergeRequestVersion(
          args.project_id,
          args.merge_request_iid,
          args.version_id,
          args.unidiff
        );
        return {
          content: [{ type: "text", text: JSON.stringify(version, null, 2) }],
        };
      }

      case "update_merge_request": {
        const args = UpdateMergeRequestSchema.parse(params.arguments);
        const { project_id, merge_request_iid, source_branch, ...options } = args;
        const mergeRequest = await updateMergeRequest(
          project_id,
          options,
          merge_request_iid,
          source_branch
        );
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "merge_merge_request": {
        const args = MergeMergeRequestSchema.parse(params.arguments);
        const { project_id, merge_request_iid, ...options } = args;
        const mergeRequest = await mergeMergeRequest(project_id, options, merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }],
        };
      }

      case "approve_merge_request": {
        const args = ApproveMergeRequestSchema.parse(params.arguments);
        const approvalState = await approveMergeRequest(
          args.project_id,
          args.merge_request_iid,
          args.sha,
          args.approval_password
        );
        return {
          content: [{ type: "text", text: JSON.stringify(approvalState, null, 2) }],
        };
      }

      case "unapprove_merge_request": {
        const args = UnapproveMergeRequestSchema.parse(params.arguments);
        const approvalState = await unapproveMergeRequest(args.project_id, args.merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(approvalState, null, 2) }],
        };
      }

      case "get_merge_request_approval_state": {
        const args = GetMergeRequestApprovalStateSchema.parse(params.arguments);
        const approvalState = await getMergeRequestApprovalState(
          args.project_id,
          args.merge_request_iid
        );
        return {
          content: [{ type: "text", text: JSON.stringify(approvalState, null, 2) }],
        };
      }

      case "mr_discussions": {
        const args = ListMergeRequestDiscussionsSchema.parse(params.arguments);
        const { project_id, merge_request_iid, ...options } = args;
        const discussions = await listMergeRequestDiscussions(
          project_id,
          merge_request_iid,
          options
        );
        return {
          content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }],
        };
      }

      case "list_namespaces": {
        const args = ListNamespacesSchema.parse(params.arguments);
        const url = new URL(`${GITLAB_API_URL}/namespaces`);

        if (args.search) {
          url.searchParams.append("search", args.search);
        }
        if (args.page) {
          url.searchParams.append("page", args.page.toString());
        }
        if (args.per_page) {
          url.searchParams.append("per_page", args.per_page.toString());
        }
        if (args.owned) {
          url.searchParams.append("owned", args.owned.toString());
        }

        const response = await fetch(url.toString(), {
          ...getFetchConfig(),
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespaces = z.array(GitLabNamespaceSchema).parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(namespaces, null, 2) }],
        };
      }

      case "get_namespace": {
        const args = GetNamespaceSchema.parse(params.arguments);
        const url = new URL(
          `${GITLAB_API_URL}/namespaces/${encodeURIComponent(args.namespace_id)}`
        );

        const response = await fetch(url.toString(), {
          ...getFetchConfig(),
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespace = GitLabNamespaceSchema.parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(namespace, null, 2) }],
        };
      }

      case "verify_namespace": {
        const args = VerifyNamespaceSchema.parse(params.arguments);
        const url = new URL(`${GITLAB_API_URL}/namespaces/${encodeURIComponent(args.path)}/exists`);

        const response = await fetch(url.toString(), {
          ...getFetchConfig(),
        });

        await handleGitLabError(response);
        const data = await response.json();
        const namespaceExists = GitLabNamespaceExistsResponseSchema.parse(data);

        return {
          content: [{ type: "text", text: JSON.stringify(namespaceExists, null, 2) }],
        };
      }

      case "get_project": {
        const args = GetProjectSchema.parse(params.arguments);
        const options = params.arguments as {
          license?: boolean;
          statistics?: boolean;
          with_custom_attributes?: boolean;
        };
        const effectiveProjectId = getEffectiveProjectId(args.project_id);
        const url = new URL(
          `${getEffectiveApiUrl()}/projects/${encodeURIComponent(effectiveProjectId)}`
        );

        if (options.license) url.searchParams.append("license", "true");
        if (options.statistics) url.searchParams.append("statistics", "true");
        if (options.with_custom_attributes)
          url.searchParams.append("with_custom_attributes", "true");

        const response = await fetch(url.toString(), {
          ...getFetchConfig(),
        });

        await handleGitLabError(response);
        const data = await response.json();
        // Return raw data without parsing through our schema to avoid type mismatches in tests
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "list_projects": {
        const args = ListProjectsSchema.parse(params.arguments);
        const projects = await listProjects(args);

        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "list_project_members": {
        const args = ListProjectMembersSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const members = await listProjectMembers(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(members, null, 2) }],
        };
      }

      case "get_users": {
        const args = GetUsersSchema.parse(params.arguments);
        const usersMap = await getUsers(args.usernames);

        return {
          content: [{ type: "text", text: JSON.stringify(usersMap, null, 2) }],
        };
      }

      case "create_note": {
        const args = CreateNoteSchema.parse(params.arguments);
        const { project_id, noteable_type, noteable_iid, body } = args;

        const note = await createNote(project_id, noteable_type, noteable_iid, body);
        return {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
      }

      case "get_draft_note": {
        const args = GetDraftNoteSchema.parse(params.arguments);
        const { project_id, merge_request_iid, draft_note_id } = args;

        const draftNote = await getDraftNote(project_id, merge_request_iid, draft_note_id);
        return {
          content: [{ type: "text", text: JSON.stringify(draftNote, null, 2) }],
        };
      }

      case "list_draft_notes": {
        const args = ListDraftNotesSchema.parse(params.arguments);
        const { project_id, merge_request_iid } = args;

        const draftNotes = await listDraftNotes(project_id, merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(draftNotes, null, 2) }],
        };
      }

      case "create_draft_note": {
        const args = CreateDraftNoteSchema.parse(params.arguments);
        const { project_id, merge_request_iid, body, in_reply_to_discussion_id, position, resolve_discussion } = args;

        const draftNote = await createDraftNote(
          project_id,
          merge_request_iid,
          body,
          in_reply_to_discussion_id,
          position,
          resolve_discussion
        );
        return {
          content: [{ type: "text", text: JSON.stringify(draftNote, null, 2) }],
        };
      }

      case "update_draft_note": {
        const args = UpdateDraftNoteSchema.parse(params.arguments);
        const { project_id, merge_request_iid, draft_note_id, body, position, resolve_discussion } =
          args;

        const draftNote = await updateDraftNote(
          project_id,
          merge_request_iid,
          draft_note_id,
          body,
          position,
          resolve_discussion
        );
        return {
          content: [{ type: "text", text: JSON.stringify(draftNote, null, 2) }],
        };
      }

      case "delete_draft_note": {
        const args = DeleteDraftNoteSchema.parse(params.arguments);
        const { project_id, merge_request_iid, draft_note_id } = args;

        await deleteDraftNote(project_id, merge_request_iid, draft_note_id);
        return {
          content: [{ type: "text", text: "Draft note deleted successfully" }],
        };
      }

      case "publish_draft_note": {
        const args = PublishDraftNoteSchema.parse(params.arguments);
        const { project_id, merge_request_iid, draft_note_id } = args;

        const publishedNote = await publishDraftNote(project_id, merge_request_iid, draft_note_id);
        return {
          content: [{ type: "text", text: JSON.stringify(publishedNote, null, 2) }],
        };
      }

      case "bulk_publish_draft_notes": {
        const args = BulkPublishDraftNotesSchema.parse(params.arguments);
        const { project_id, merge_request_iid } = args;

        const publishedNotes = await bulkPublishDraftNotes(project_id, merge_request_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(publishedNotes, null, 2) }],
        };
      }

      case "create_merge_request_thread": {
        const args = CreateMergeRequestThreadSchema.parse(params.arguments);
        const { project_id, merge_request_iid, body, position, created_at } = args;

        const thread = await createMergeRequestThread(
          project_id,
          merge_request_iid,
          body,
          position,
          created_at
        );
        return {
          content: [{ type: "text", text: JSON.stringify(thread, null, 2) }],
        };
      }

      case "resolve_merge_request_thread": {
        const args = ResolveMergeRequestThreadSchema.parse(params.arguments);
        const { project_id, merge_request_iid, discussion_id, resolved } = args;
        await resolveMergeRequestThread(project_id, merge_request_iid, discussion_id, resolved);
        return {
          content: [{ type: "text", text: "Thread resolved successfully" }],
        };
      }

      case "list_issues": {
        const args = ListIssuesSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const issues = await listIssues(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        };
      }

      case "my_issues": {
        const args = MyIssuesSchema.parse(params.arguments);
        const issues = await myIssues(args);
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        };
      }

      case "get_issue": {
        const args = GetIssueSchema.parse(params.arguments);
        const issue = await getIssue(args.project_id, args.issue_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "update_issue": {
        const args = UpdateIssueSchema.parse(params.arguments);
        const { project_id, issue_iid, ...options } = args;
        const issue = await updateIssue(project_id, issue_iid, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "delete_issue": {
        const args = DeleteIssueSchema.parse(params.arguments);
        await deleteIssue(args.project_id, args.issue_iid);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Issue deleted successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_issue_links": {
        const args = ListIssueLinksSchema.parse(params.arguments);
        const links = await listIssueLinks(args.project_id, args.issue_iid);
        return {
          content: [{ type: "text", text: JSON.stringify(links, null, 2) }],
        };
      }

      case "list_issue_discussions": {
        const args = ListIssueDiscussionsSchema.parse(params.arguments);
        const { project_id, issue_iid, ...options } = args;

        const discussions = await listIssueDiscussions(project_id, issue_iid, options);
        return {
          content: [{ type: "text", text: JSON.stringify(discussions, null, 2) }],
        };
      }

      case "get_issue_link": {
        const args = GetIssueLinkSchema.parse(params.arguments);
        const link = await getIssueLink(args.project_id, args.issue_iid, args.issue_link_id);
        return {
          content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
        };
      }

      case "create_issue_link": {
        const args = CreateIssueLinkSchema.parse(params.arguments);
        const link = await createIssueLink(
          args.project_id,
          args.issue_iid,
          args.target_project_id,
          args.target_issue_iid,
          args.link_type
        );
        return {
          content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
        };
      }

      case "delete_issue_link": {
        const args = DeleteIssueLinkSchema.parse(params.arguments);
        await deleteIssueLink(args.project_id, args.issue_iid, args.issue_link_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Issue link deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_labels": {
        const args = ListLabelsSchema.parse(params.arguments);
        const labels = await listLabels(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
        };
      }

      case "get_label": {
        const args = GetLabelSchema.parse(params.arguments);
        const label = await getLabel(args.project_id, args.label_id, args.include_ancestor_groups);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "create_label": {
        const args = CreateLabelSchema.parse(params.arguments);
        const label = await createLabel(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "update_label": {
        const args = UpdateLabelSchema.parse(params.arguments);
        const { project_id, label_id, ...options } = args;
        const label = await updateLabel(project_id, label_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(label, null, 2) }],
        };
      }

      case "delete_label": {
        const args = DeleteLabelSchema.parse(params.arguments);
        await deleteLabel(args.project_id, args.label_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Label deleted successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_group_projects": {
        const args = ListGroupProjectsSchema.parse(params.arguments);
        const projects = await listGroupProjects(args);
        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "list_wiki_pages": {
        const { project_id, page, per_page, with_content } = ListWikiPagesSchema.parse(
          params.arguments
        );
        const wikiPages = await listWikiPages(project_id, {
          page,
          per_page,
          with_content,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPages, null, 2) }],
        };
      }

      case "get_wiki_page": {
        const { project_id, slug } = GetWikiPageSchema.parse(params.arguments);
        const wikiPage = await getWikiPage(project_id, slug);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "create_wiki_page": {
        const { project_id, title, content, format } = CreateWikiPageSchema.parse(params.arguments);
        const wikiPage = await createWikiPage(project_id, title, content, format);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "update_wiki_page": {
        const { project_id, slug, title, content, format } = UpdateWikiPageSchema.parse(
          params.arguments
        );
        const wikiPage = await updateWikiPage(project_id, slug, title, content, format);
        return {
          content: [{ type: "text", text: JSON.stringify(wikiPage, null, 2) }],
        };
      }

      case "delete_wiki_page": {
        const { project_id, slug } = DeleteWikiPageSchema.parse(params.arguments);
        await deleteWikiPage(project_id, slug);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Wiki page deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_repository_tree": {
        const args = GetRepositoryTreeSchema.parse(params.arguments);
        const tree = await getRepositoryTree(args);
        return {
          content: [{ type: "text", text: JSON.stringify(tree, null, 2) }],
        };
      }

      case "list_pipelines": {
        const args = ListPipelinesSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const pipelines = await listPipelines(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(pipelines, null, 2) }],
        };
      }

      case "get_pipeline": {
        const { project_id, pipeline_id } = GetPipelineSchema.parse(params.arguments);
        const pipeline = await getPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pipeline, null, 2),
            },
          ],
        };
      }

      case "list_pipeline_jobs": {
        const { project_id, pipeline_id, ...options } = ListPipelineJobsSchema.parse(
          params.arguments
        );
        const jobs = await listPipelineJobs(project_id, pipeline_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      }

      case "list_pipeline_trigger_jobs": {
        const { project_id, pipeline_id, ...options } = ListPipelineTriggerJobsSchema.parse(
          params.arguments
        );
        const triggerJobs = await listPipelineTriggerJobs(project_id, pipeline_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(triggerJobs, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_job": {
        const { project_id, job_id } = GetPipelineJobOutputSchema.parse(params.arguments);
        const jobDetails = await getPipelineJob(project_id, job_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobDetails, null, 2),
            },
          ],
        };
      }

      case "get_pipeline_job_output": {
        const { project_id, job_id, limit, offset } = GetPipelineJobOutputSchema.parse(
          params.arguments
        );
        const jobOutput = await getPipelineJobOutput(project_id, job_id, limit, offset);
        return {
          content: [
            {
              type: "text",
              text: jobOutput,
            },
          ],
        };
      }

      case "create_pipeline": {
        const { project_id, ref, variables } = CreatePipelineSchema.parse(params.arguments);
        const pipeline = await createPipeline(project_id, ref, variables);
        return {
          content: [
            {
              type: "text",
              text: `Created pipeline #${pipeline.id} for ${ref}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "retry_pipeline": {
        const { project_id, pipeline_id } = RetryPipelineSchema.parse(params.arguments);
        const pipeline = await retryPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: `Retried pipeline #${pipeline.id}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "cancel_pipeline": {
        const { project_id, pipeline_id } = CancelPipelineSchema.parse(params.arguments);
        const pipeline = await cancelPipeline(project_id, pipeline_id);
        return {
          content: [
            {
              type: "text",
              text: `Canceled pipeline #${pipeline.id}. Status: ${pipeline.status}\nWeb URL: ${pipeline.web_url}`,
            },
          ],
        };
      }

      case "play_pipeline_job": {
        const { project_id, job_id, job_variables_attributes } = PlayPipelineJobSchema.parse(
          params.arguments
        );
        const job = await playPipelineJob(project_id, job_id, job_variables_attributes);
        return {
          content: [
            {
              type: "text",
              text: `Ran job #${job.id} (${job.name}). Status: ${job.status}\nWeb URL: ${job.web_url}`,
            },
          ],
        };
      }

      case "retry_pipeline_job": {
        const { project_id, job_id } = RetryPipelineJobSchema.parse(params.arguments);
        const job = await retryPipelineJob(project_id, job_id);
        return {
          content: [
            {
              type: "text",
              text: `Retried job #${job.id} (${job.name}). Status: ${job.status}\nWeb URL: ${job.web_url}`,
            },
          ],
        };
      }

      case "cancel_pipeline_job": {
        const { project_id, job_id, force } = CancelPipelineJobSchema.parse(params.arguments);
        const job = await cancelPipelineJob(project_id, job_id, force);
        return {
          content: [
            {
              type: "text",
              text: `Canceled job #${job.id} (${job.name}). Status: ${job.status}\nWeb URL: ${job.web_url}`,
            },
          ],
        };
      }

      case "list_merge_requests": {
        const args = ListMergeRequestsSchema.parse(params.arguments);
        const mergeRequests = await listMergeRequests(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(mergeRequests, null, 2) }],
        };
      }

      case "list_milestones": {
        const { project_id, ...options } = ListProjectMilestonesSchema.parse(params.arguments);
        const milestones = await listProjectMilestones(project_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestones, null, 2),
            },
          ],
        };
      }

      case "get_milestone": {
        const { project_id, milestone_id } = GetProjectMilestoneSchema.parse(params.arguments);
        const milestone = await getProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "create_milestone": {
        const { project_id, ...options } = CreateProjectMilestoneSchema.parse(params.arguments);
        const milestone = await createProjectMilestone(project_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "edit_milestone": {
        const { project_id, milestone_id, ...options } = EditProjectMilestoneSchema.parse(
          params.arguments
        );
        const milestone = await editProjectMilestone(project_id, milestone_id, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "delete_milestone": {
        const { project_id, milestone_id } = DeleteProjectMilestoneSchema.parse(params.arguments);
        await deleteProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  message: "Milestone deleted successfully",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_milestone_issue": {
        const { project_id, milestone_id } = GetMilestoneIssuesSchema.parse(params.arguments);
        const issues = await getMilestoneIssues(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(issues, null, 2),
            },
          ],
        };
      }

      case "get_milestone_merge_requests": {
        const { project_id, milestone_id } = GetMilestoneMergeRequestsSchema.parse(
          params.arguments
        );
        const mergeRequests = await getMilestoneMergeRequests(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(mergeRequests, null, 2),
            },
          ],
        };
      }

      case "promote_milestone": {
        const { project_id, milestone_id } = PromoteProjectMilestoneSchema.parse(params.arguments);
        const milestone = await promoteProjectMilestone(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(milestone, null, 2),
            },
          ],
        };
      }

      case "get_milestone_burndown_events": {
        const { project_id, milestone_id } = GetMilestoneBurndownEventsSchema.parse(
          params.arguments
        );
        const events = await getMilestoneBurndownEvents(project_id, milestone_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(events, null, 2),
            },
          ],
        };
      }

      case "list_commits": {
        const args = ListCommitsSchema.parse(params.arguments);
        const commits = await listCommits(args.project_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(commits, null, 2) }],
        };
      }

      case "get_commit": {
        const args = GetCommitSchema.parse(params.arguments);
        const commit = await getCommit(args.project_id, args.sha, args.stats);
        return {
          content: [{ type: "text", text: JSON.stringify(commit, null, 2) }],
        };
      }

      case "get_commit_diff": {
        const args = GetCommitDiffSchema.parse(params.arguments);
        const diff = await getCommitDiff(args.project_id, args.sha, args.full_diff);
        return {
          content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
        };
      }

      case "list_group_iterations": {
        const args = ListGroupIterationsSchema.parse(params.arguments);
        const iterations = await listGroupIterations(args.group_id, args);
        return {
          content: [{ type: "text", text: JSON.stringify(iterations, null, 2) }],
        };
      }

      case "upload_markdown": {
        const args = MarkdownUploadSchema.parse(params.arguments);
        const upload = await markdownUpload(args.project_id, args.file_path);
        return {
          content: [{ type: "text", text: JSON.stringify(upload, null, 2) }],
        };
      }

      case "download_attachment": {
        const args = DownloadAttachmentSchema.parse(params.arguments);
        const result = await downloadAttachment(
          args.project_id,
          args.secret,
          args.filename,
          args.local_path
        );

        if (result.mimeType && !args.local_path) {
          // Return image inline as base64 so the AI can see it
          const base64 = result.buffer.toString("base64");
          return {
            content: [
              { type: "image", data: base64, mimeType: result.mimeType },
              {
                type: "text",
                text: JSON.stringify({ filename: result.filename, mimeType: result.mimeType }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, file_path: result.savedPath }, null, 2),
            },
          ],
        };
      }

      case "list_events": {
        const args = ListEventsSchema.parse(params.arguments);
        const events = await listEvents(args);
        return {
          content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
        };
      }

      case "get_project_events": {
        const args = GetProjectEventsSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const events = await getProjectEvents(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
        };
      }

      case "list_releases": {
        const args = ListReleasesSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const releases = await listReleases(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(releases, null, 2) }],
        };
      }

      case "get_release": {
        const args = GetReleaseSchema.parse(params.arguments);
        const release = await getRelease(
          args.project_id,
          args.tag_name,
          args.include_html_description
        );
        return {
          content: [{ type: "text", text: JSON.stringify(release, null, 2) }],
        };
      }

      case "create_release": {
        const args = CreateReleaseSchema.parse(params.arguments);
        const { project_id, ...options } = args;
        const release = await createRelease(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(release, null, 2) }],
        };
      }

      case "update_release": {
        const args = UpdateReleaseSchema.parse(params.arguments);
        const { project_id, tag_name, ...options } = args;
        const release = await updateRelease(project_id, tag_name, options);
        return {
          content: [{ type: "text", text: JSON.stringify(release, null, 2) }],
        };
      }

      case "delete_release": {
        const args = DeleteReleaseSchema.parse(params.arguments);
        const release = await deleteRelease(args.project_id, args.tag_name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Release deleted successfully", release },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_release_evidence": {
        const args = CreateReleaseEvidenceSchema.parse(params.arguments);
        await createReleaseEvidence(args.project_id, args.tag_name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: "success", message: "Release evidence created successfully" },
                null,
                2
              ),
            },
          ],
        };
      }

      case "download_release_asset": {
        const args = DownloadReleaseAssetSchema.parse(params.arguments);
        const assetContent = await downloadReleaseAsset(
          args.project_id,
          args.tag_name,
          args.direct_asset_path
        );
        return {
          content: [{ type: "text", text: assetContent }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${params.name}`);
    }
  } catch (error) {
    logger.debug(params);
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map(e => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
}

/**
 *  Color constants for terminal output
 */
const colorGreen = "\x1b[32m";
const colorReset = "\x1b[0m";

/**
 * Determine the transport mode based on environment variables and availability
 *
 * Transport mode priority (highest to lowest):
 * 1. STREAMABLE_HTTP
 * 2. SSE
 * 3. STDIO
 */
function determineTransportMode(): TransportMode {
  // Check for streamable-http support (highest priority)
  if (STREAMABLE_HTTP) {
    return TransportMode.STREAMABLE_HTTP;
  }

  // Check for SSE support (medium priority)
  if (SSE) {
    return TransportMode.SSE;
  }

  // Default to stdio (lowest priority)
  return TransportMode.STDIO;
}

/**
 * Start server with stdio transport
 */
async function startStdioServer(): Promise<void> {
  const serverInstance = createServer();
  const transport = new StdioServerTransport();
  await serverInstance.connect(transport);
}

/**
 * Start server with traditional SSE transport
 */
async function startSSEServer(): Promise<void> {
  const app = express();
  const transports: { [sessionId: string]: SSEServerTransport } = {};

  app.get("/sse", async (_: Request, res: Response) => {
    const serverInstance = createServer();
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
      delete transports[transport.sessionId];
    });
    await serverInstance.connect(transport);
  });

  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No transport found for sessionId");
    }
  });

  app.get("/health", (_: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      version: SERVER_VERSION,
      transport: TransportMode.SSE,
    });
  });

  app.listen(Number(PORT), HOST, () => {
    logger.info(`GitLab MCP Server running with SSE transport`);
    const colorGreen = "\x1b[32m";
    const colorReset = "\x1b[0m";
    logger.info(`${colorGreen}Endpoint: http://${HOST}:${PORT}/sse${colorReset}`);
  });
}

/**
 * Start server with Streamable HTTP transport
 */
async function startStreamableHTTPServer(): Promise<void> {
  const app = express();
  const streamableTransports: {
    [sessionId: string]: StreamableHTTPServerTransport;
  } = {};

  const authTimeouts: Record<string, NodeJS.Timeout> = {};

  // Configuration and limits
  const MAX_SESSIONS = Number.parseInt(process.env.MAX_SESSIONS || "1000", 10);
  const MAX_REQUESTS_PER_MINUTE = Number.parseInt(process.env.MAX_REQUESTS_PER_MINUTE || "60", 10);

  // Metrics tracking
  const metrics = {
    activeSessions: 0,
    totalSessions: 0,
    expiredSessions: 0,
    authFailures: 0,
    requestsProcessed: 0,
    rejectedByRateLimit: 0,
    rejectedByCapacity: 0,
  };

  // Rate limiting per session
  const sessionRequestCounts: Record<string, { count: number; resetAt: number }> = {};

  /**
   * Validate token format and length
   */
  const validateToken = (token: string): boolean => {
    // GitLab PAT format: glpat-xxxxx (min 20 chars)
    if (token.length < 20) return false;
    if (!/^[-a-zA-Z0-9_.]+$/.test(token)) return false;
    return true;
  };

  /**
   * Check rate limit for session
   */
  const checkRateLimit = (sessionId: string): boolean => {
    const now = Date.now();
    const session = sessionRequestCounts[sessionId];

    if (!session || now > session.resetAt) {
      sessionRequestCounts[sessionId] = { count: 1, resetAt: now + 60000 };
      return true;
    }

    if (session.count >= MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    session.count++;
    return true;
  };

  /**
   * Parse authentication from request headers
   * Returns null if no auth found or invalid format
   */
  const parseAuthHeaders = (req: Request): AuthData | null => {
    const authHeader = (req.headers["authorization"] as string | undefined) || "";
    const privateToken = (req.headers["private-token"] as string | undefined) || "";
    const dynamicApiUrl = (req.headers["x-gitlab-api-url"] as string | undefined)?.trim();

    let apiUrl = GITLAB_API_URL; // Default API URL

    // Only process dynamic URL if the feature is enabled
    if (ENABLE_DYNAMIC_API_URL && dynamicApiUrl) {
      try {
        new URL(dynamicApiUrl); // Ensure it's a valid URL format
        apiUrl = normalizeGitLabApiUrl(dynamicApiUrl);
      } catch {
        logger.warn(`Invalid X-GitLab-API-URL provided: ${dynamicApiUrl}. Auth will fail.`);
        return null; // Reject if URL is malformed
      }
    }

    // Extract token
    let token: string | null = null;
    let header: "Authorization" | "Private-Token" | null = null;

    if (privateToken) {
      token = privateToken.trim();
      header = "Private-Token";
    } else if (authHeader) {
      // Use \S+ instead of .+ to prevent ReDoS attacks
      // \S+ only matches non-whitespace, so trim() is technically unnecessary,
      // but we keep it for defensive coding and backward compatibility
      const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
      if (match) {
        token = match[1].trim();
        header = "Authorization";
      }
    }

    // Validate token and return AuthData object
    if (token && header && validateToken(token)) {
      return { header, token, lastUsed: Date.now(), apiUrl };
    }

    return null;
  };

  /**
   * Set or reset timeout for session auth
   * After SESSION_TIMEOUT_SECONDS of inactivity, the auth token is removed
   * but the transport session remains active
   */
  const setAuthTimeout = (sessionId: string) => {
    // Clear existing timeout if any
    clearAuthTimeout(sessionId);

    // Set new timeout
    authTimeouts[sessionId] = setTimeout(() => {
      if (authBySession[sessionId]) {
        logger.info(
          `Session ${sessionId}: auth token expired after ${SESSION_TIMEOUT_SECONDS}s of inactivity`
        );
        delete authBySession[sessionId];
        delete authTimeouts[sessionId];
        metrics.expiredSessions++;
      }
    }, SESSION_TIMEOUT_SECONDS * 1000);
  };

  /**
   * Clear timeout for session auth
   */
  const clearAuthTimeout = (sessionId: string) => {
    const timeout = authTimeouts[sessionId];
    if (timeout) {
      clearTimeout(timeout);
      delete authTimeouts[sessionId];
    }
  };

  /**
   * Clean up session auth data
   */
  const cleanupSessionAuth = (sessionId: string) => {
    delete authBySession[sessionId];
    clearAuthTimeout(sessionId);
  };

  // Configure Express middleware
  app.use(express.json());

  // Streamable HTTP endpoint - handles both session creation and message handling
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;

    // Track request
    metrics.requestsProcessed++;

    // Rate limiting check for existing sessions
    if (REMOTE_AUTHORIZATION && sessionId && !checkRateLimit(sessionId)) {
      metrics.rejectedByRateLimit++;
      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute allowed`,
      });
      return;
    }

    // Capacity check for new sessions
    if (!sessionId && Object.keys(streamableTransports).length >= MAX_SESSIONS) {
      metrics.rejectedByCapacity++;
      res.status(503).json({
        error: "Server capacity reached",
        message: `Maximum ${MAX_SESSIONS} concurrent sessions allowed. Please try again later.`,
      });
      return;
    }

    // Handle remote authorization: extract and store auth headers per session
    if (REMOTE_AUTHORIZATION) {
      const authData = parseAuthHeaders(req);

      if (sessionId && !authBySession[sessionId]) {
        // New session: require auth headers
        if (!authData) {
          metrics.authFailures++;
          res.status(401).json({
            error: "Missing Authorization or Private-Token header",
            message:
              "Remote authorization is enabled. Please provide Authorization or Private-Token header.",
          });
          return;
        }
        // Store auth for this session
        authBySession[sessionId] = authData;
        logger.info(`Session ${sessionId}: stored ${authData.header} header`);
        setAuthTimeout(sessionId);
      } else if (sessionId && authData) {
        // Existing session: allow auth rotation/update
        authBySession[sessionId] = authData;
        logger.debug(`Session ${sessionId}: updated ${authData.header} header`);
        setAuthTimeout(sessionId);
      } else if (sessionId && authBySession[sessionId]) {
        // Existing session with stored auth: update last used time and reset timeout
        authBySession[sessionId].lastUsed = Date.now();
        setAuthTimeout(sessionId);
      } else if (!sessionId && !authData) {
        // First request without session - will fail in initialization
      }
    }

    // Handle request with proper AsyncLocalStorage context
    const handleRequest = async () => {
      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && streamableTransports[sessionId]) {
          // Reuse existing transport for ongoing session
          transport = streamableTransports[sessionId];

          await transport.handleRequest(req, res, req.body);
        } else {
          // Create new transport for new session
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId: string) => {
              streamableTransports[newSessionId] = transport;
              metrics.totalSessions++;
              metrics.activeSessions++;
              logger.warn(`Streamable HTTP session initialized: ${newSessionId}`);

              // Store auth for newly created session in remote mode
              if (REMOTE_AUTHORIZATION && !authBySession[newSessionId]) {
                const authData = parseAuthHeaders(req);
                if (authData) {
                  authBySession[newSessionId] = authData;
                  logger.info(`Session ${newSessionId}: stored ${authData.header} header`);
                  setAuthTimeout(newSessionId);
                }
              }
            },
          });

          // Set up cleanup handler when transport closes
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && streamableTransports[sid]) {
              logger.warn(`Streamable HTTP transport closed for session ${sid}, cleaning up`);
              delete streamableTransports[sid];
              metrics.activeSessions--;
              if (REMOTE_AUTHORIZATION) {
                cleanupSessionAuth(sid);
                delete sessionRequestCounts[sid];
                logger.info(`Session ${sid}: cleaned up auth mapping`);
              }
            }
          };

          // Create a new Server instance per session to prevent
          // cross-client data leakage (GHSA-345p-7cg4-v4c7)
          const serverInstance = createServer();
          await serverInstance.connect(transport);

          // Handle the request - context is already set up in the outer handleRequest wrapper
          await transport.handleRequest(req, res, req.body);
        }
      } catch (error) {
        logger.error("Streamable HTTP error:", error);
        res.status(500).json({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    // Execute with auth context in remote mode
    if (REMOTE_AUTHORIZATION && sessionId && authBySession[sessionId]) {
      const authData = authBySession[sessionId];
      const ctx: SessionAuth = {
        sessionId,
        header: authData.header,
        token: authData.token,
        lastUsed: authData.lastUsed,
        apiUrl: authData.apiUrl,
      };

      // Run the entire request handling within AsyncLocalStorage context
      await sessionAuthStore.run(ctx, handleRequest);
    } else {
      // Standard execution (no remote auth or no session yet)
      await handleRequest();
    }
  });

  // Reject unsupported methods on /mcp
  app.get("/mcp", (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST, DELETE");
    res.status(405).json({
      error: "Method Not Allowed",
      message:
        "GET /mcp is not supported when STREAMABLE_HTTP is enabled. Use POST to communicate with the MCP server.",
    });
  });

  // Metrics endpoint
  app.get("/metrics", (_req: Request, res: Response) => {
    res.json({
      ...metrics,
      activeSessions: Object.keys(streamableTransports).length,
      authenticatedSessions: Object.keys(authBySession).length,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      config: {
        maxSessions: MAX_SESSIONS,
        maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
        sessionTimeoutSeconds: SESSION_TIMEOUT_SECONDS,
        remoteAuthEnabled: REMOTE_AUTHORIZATION,
      },
    });
  });

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    const isHealthy = Object.keys(streamableTransports).length < MAX_SESSIONS;
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "healthy" : "degraded",
      activeSessions: Object.keys(streamableTransports).length,
      maxSessions: MAX_SESSIONS,
      uptime: process.uptime(),
    });
  });

  // to delete a mcp server session explicitly
  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;

    if (!sessionId) {
      res.status(400).json({ error: "mcp-session-id header is required" });
      return;
    }

    const transport = streamableTransports[sessionId];

    if (transport) {
      try {
        await transport.close();
        logger.info(`Explicitly closed session via DELETE request: ${sessionId}`);
        if (REMOTE_AUTHORIZATION) {
          cleanupSessionAuth(sessionId);
          delete sessionRequestCounts[sessionId];
          logger.info(`Session ${sessionId}: cleaned up auth mapping on DELETE`);
        }
        res.status(204).send();
      } catch (error) {
        logger.error(`Error closing session ${sessionId}:`, error);
        res.status(500).json({ error: "Failed to close session" });
      }
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  // Start server
  const httpServer = app.listen(Number(PORT), HOST, () => {
    logger.info(`GitLab MCP Server running with Streamable HTTP transport`);
    logger.info(`${colorGreen}Endpoint: http://${HOST}:${PORT}/mcp${colorReset}`);
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    httpServer.close(() => {
      logger.info("HTTP server closed");
    });

    // Close all active sessions
    const sessionIds = Object.keys(streamableTransports);
    logger.info(`Closing ${sessionIds.length} active sessions...`);

    const closePromises = sessionIds.map(async sessionId => {
      try {
        const transport = streamableTransports[sessionId];
        if (transport) {
          await transport.close();
          if (REMOTE_AUTHORIZATION) {
            cleanupSessionAuth(sessionId);
            delete sessionRequestCounts[sessionId];
          }
        }
      } catch (error) {
        logger.error(`Error closing session ${sessionId}:`, error);
      }
    });

    await Promise.allSettled(closePromises);

    // Clear all timeouts
    Object.keys(authTimeouts).forEach(sessionId => {
      clearAuthTimeout(sessionId);
    });

    logger.info("Graceful shutdown complete");
    process.exit(0);
  };

  // Register signal handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

/**
 * Initialize server with specific transport mode
 * Handle transport-specific initialization logic
 */
async function initializeServerByTransportMode(mode: TransportMode): Promise<void> {
  logger.info("Initializing server with transport mode:", mode);
  switch (mode) {
    case TransportMode.STDIO:
      logger.warn("Starting GitLab MCP Server with stdio transport");
      await startStdioServer();
      break;

    case TransportMode.SSE:
      logger.warn("Starting GitLab MCP Server with SSE transport");
      await startSSEServer();
      break;

    case TransportMode.STREAMABLE_HTTP:
      logger.warn("Starting GitLab MCP Server with Streamable HTTP transport");
      await startStreamableHTTPServer();
      break;

    default: {
      // This should never happen with proper enum usage, but TypeScript requires it
      const exhaustiveCheck: never = mode;
      throw new Error(`Unknown transport mode: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Initialize and run the server
 * Main entry point for server startup
 */
async function runServer() {
  try {
    // Validate configuration before starting server
    validateConfiguration();

    // Initialize OAuth token if OAuth is enabled
    if (USE_OAUTH) {
      logger.info("Using OAuth authentication...");
      try {
        const gitlabBaseUrl = GITLAB_API_URL.replace(/\/api\/v4$/, "");
        OAUTH_ACCESS_TOKEN = await initializeOAuth(gitlabBaseUrl);
        logger.info("OAuth authentication successful");
        // Note: Headers are automatically generated by buildAuthHeaders() using OAUTH_ACCESS_TOKEN
      } catch (error) {
        logger.error("OAuth authentication failed:", error);
        process.exit(1);
      }
    }

    const transportMode = determineTransportMode();
    await initializeServerByTransportMode(transportMode);

    logger.info(`Configured GitLab API URLs: ${GITLAB_API_URLS.join(", ")}`);
    logger.info(`Default GitLab API URL: ${GITLAB_API_URL}`);
  } catch (error) {
    logger.error("Error initializing server:", error);
    process.exit(1);
  }
}

// 下記の２行を追記
runServer().catch(error => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
