import type { RequestInit as UndiciRequestInit } from "undici";
import { z } from "zod";

import {
  redactSensitiveGitLabFields,
  redactSensitiveGitLabText,
} from "../utils/redact-sensitive.js";
import {
  normalizeGitLabApiRelativePath,
  readProjectIdFromApiRelativePath,
  resolveGitLabApiRequestUrl,
} from "../utils/url.js";

/**
 * Methods this tool will send. HEAD is omitted: callers do not need it, and
 * a smaller allowlist is easier to gate. DELETE stays in the schema so
 * `modify` can reject it at call time instead of hiding the whole tool.
 */
export const GITLAB_API_REQUEST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type GitLabApiRequestMethod = (typeof GITLAB_API_REQUEST_METHODS)[number];

const QUERY_SCALAR = z.union([z.string(), z.number(), z.boolean()]);

export const GitLabApiRequestSchema = z.object({
  method: z
    .enum(GITLAB_API_REQUEST_METHODS)
    .optional()
    .describe(
      "HTTP method. Defaults to GET. Non-GET requires a permission mode that allows writes. DELETE is rejected in modify mode."
    ),
  path: z
    .string()
    .min(1)
    .describe(
      "Path relative to /api/v4, such as projects/1 or /projects/1/issues. Absolute URLs are rejected."
    ),
  query: z
    .record(z.string(), z.union([QUERY_SCALAR, z.array(QUERY_SCALAR)]))
    .optional()
    .describe("Query string parameters. Arrays are repeated as separate keys."),
  body: z
    .unknown()
    .optional()
    .describe("JSON request body for POST, PUT, PATCH, and DELETE. Rejected on GET."),
});

export type GitLabApiRequestArgs = z.infer<typeof GitLabApiRequestSchema>;

export class GitLabApiRequestInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitLabApiRequestInputError";
  }
}

export class GitLabApiRequestHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitLabApiRequestHttpError";
  }
}

export interface GitLabApiRequestResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  text(): Promise<string>;
}

export interface ExecuteGitLabApiRequestInput {
  readonly args: unknown;
  readonly apiBaseUrl: string;
  readonly permissionMode: string;
  readonly allowedProjectIds: readonly string[];
  readonly fetchImpl: (url: string, init: UndiciRequestInit) => Promise<GitLabApiRequestResponse>;
  readonly fetchConfig: () => UndiciRequestInit;
}

export interface GitLabApiRequestToolResult {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }];
}

const REQUEST_TIMEOUT_MS = 45_000;

export function assertGitLabApiRequestMethodAllowed(
  method: GitLabApiRequestMethod,
  permissionMode: string
): void {
  if (method === "GET") {
    return;
  }
  if (permissionMode === "readonly") {
    throw new GitLabApiRequestInputError(
      "gitlab_api_request allows only GET when GITLAB_READ_ONLY_MODE=true or GITLAB_PERMISSION_MODE=readonly"
    );
  }
  if (permissionMode === "modify" && method === "DELETE") {
    throw new GitLabApiRequestInputError(
      "gitlab_api_request rejects DELETE when GITLAB_PERMISSION_MODE=modify (delete operations are disabled)"
    );
  }
}

function assertBodyAllowed(method: GitLabApiRequestMethod, body: unknown): void {
  if (method === "GET" && body !== undefined) {
    throw new GitLabApiRequestInputError("gitlab_api_request rejects a body on GET");
  }
}

function projectAllowed(
  projectId: string,
  rawSegment: string,
  allowlist: readonly string[]
): boolean {
  const candidates = new Set([projectId, rawSegment]);
  for (const entry of allowlist) {
    if (candidates.has(entry)) {
      return true;
    }
    try {
      if (candidates.has(decodeURIComponent(entry))) {
        return true;
      }
    } catch {
      // An undecodable allowlist entry cannot match this path.
    }
  }
  return false;
}

function assertProjectAllowlist(relativePath: string, allowlist: readonly string[]): void {
  if (allowlist.length === 0) {
    return;
  }
  const match = /^projects\/([^/]+)(?:\/|$)/.exec(relativePath);
  if (!match) {
    return;
  }
  const rawSegment = match[1];
  let projectId: string;
  try {
    projectId = readProjectIdFromApiRelativePath(relativePath) ?? rawSegment;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GitLabApiRequestInputError(message);
  }
  if (!projectAllowed(projectId, rawSegment, allowlist)) {
    throw new GitLabApiRequestInputError(
      `Access denied: Project ${projectId} is not in the allowed project list: ${allowlist.join(", ")}`
    );
  }
}

function appendQuery(url: URL, query: GitLabApiRequestArgs["query"]): void {
  if (!query) {
    return;
  }
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}

function formatHttpError(status: number, statusText: string, rawBody: string): string {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) {
    return `GitLab API error: ${status} ${statusText}`;
  }
  try {
    const parsed: unknown = JSON.parse(rawBody);
    redactSensitiveGitLabFields(parsed);
    return `GitLab API error: ${status} ${statusText}\n${JSON.stringify(parsed)}`;
  } catch {
    return `GitLab API error: ${status} ${statusText}\n${redactSensitiveGitLabText(rawBody)}`;
  }
}

function formatSuccessBody(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) {
    return "";
  }
  try {
    const parsed: unknown = JSON.parse(rawBody);
    redactSensitiveGitLabFields(parsed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return redactSensitiveGitLabText(rawBody);
  }
}

export async function executeGitLabApiRequestAsync(
  input: ExecuteGitLabApiRequestInput
): Promise<GitLabApiRequestToolResult> {
  const args = GitLabApiRequestSchema.parse(input.args);
  const method = args.method ?? "GET";
  assertGitLabApiRequestMethodAllowed(method, input.permissionMode);
  assertBodyAllowed(method, args.body);

  let url: URL;
  let relative: string;
  try {
    relative = normalizeGitLabApiRelativePath(args.path);
    url = resolveGitLabApiRequestUrl(input.apiBaseUrl, args.path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GitLabApiRequestInputError(message);
  }

  assertProjectAllowlist(relative, input.allowedProjectIds);
  appendQuery(url, args.query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await input.fetchImpl(url.toString(), {
      ...input.fetchConfig(),
      method,
      ...(method === "GET" || args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new GitLabApiRequestHttpError(
        formatHttpError(response.status, response.statusText, rawBody)
      );
    }
    return { content: [{ type: "text", text: formatSuccessBody(rawBody) }] };
  } finally {
    clearTimeout(timeout);
  }
}
