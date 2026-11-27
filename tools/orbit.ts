/**
 * Orbit toolset: the GitLab Orbit graph tool handlers and the REST helpers only they call.
 *
 * index.ts owns the request plumbing these handlers use (the auth-retry fetch, GitLab
 * error handling, the strict project scope guard) and hands it over once with
 * configureOrbitTools(). The fetch is read at call time, since index.ts replaces it when
 * the cookie jar reloads.
 */
import type { Response as UndiciResponse } from "undici";
import type { FetchFn } from "../auth-retry.js";
import {
  OrbitQuerySchema,
  OrbitSchemaSchema,
  OrbitStatusSchema,
  OrbitToolsSchema,
} from "../schemas.js";
import { getEffectiveApiUrl, getFetchConfig } from "../server/gitlab-request-context.js";

export interface OrbitToolDeps {
  /** The auth-retry fetch from index.ts, re-read on every call because it is reassigned. */
  getFetch: () => FetchFn;
  handleGitLabError: (response: UndiciResponse) => Promise<void>;
  rejectIfStrictProjectScope: (toolName: string) => void;
}

let deps: OrbitToolDeps | undefined;

export function configureOrbitTools(next: OrbitToolDeps): void {
  deps = next;
}

function requireDeps(): OrbitToolDeps {
  if (!deps) {
    throw new Error("Orbit tools used before configureOrbitTools()");
  }
  return deps;
}

const fetch: FetchFn = (input, init) => requireDeps().getFetch()(input, init);

function handleGitLabError(response: UndiciResponse): Promise<void> {
  return requireDeps().handleGitLabError(response);
}

function rejectIfStrictProjectScope(toolName: string): void {
  requireDeps().rejectIfStrictProjectScope(toolName);
}

/**
 * Execute a GitLab Orbit graph query.
 * Note: the `llm` format returns compact plain text, not JSON.
 */
async function orbitQuery(query: Record<string, unknown>, format: "raw" | "llm"): Promise<unknown> {
  const url = new URL(`${getEffectiveApiUrl()}/orbit/query`);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
    method: "POST",
    body: JSON.stringify({ query, format }),
  });

  await handleGitLabError(response);
  if (format === "raw") {
    return response.json();
  }
  return response.text();
}

async function orbitGetSchema(): Promise<unknown> {
  const url = new URL(`${getEffectiveApiUrl()}/orbit/schema`);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  return response.json();
}

async function orbitGetStatus(): Promise<unknown> {
  const url = new URL(`${getEffectiveApiUrl()}/orbit/status`);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  return response.json();
}

async function orbitListTools(): Promise<unknown> {
  const url = new URL(`${getEffectiveApiUrl()}/orbit/tools`);

  const response = await fetch(url.toString(), {
    ...getFetchConfig(),
  });

  await handleGitLabError(response);
  return response.json();
}

export interface OrbitToolCallParams {
  name: string;
  arguments: unknown;
}

export interface OrbitToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export async function handleOrbitToolCall(params: OrbitToolCallParams): Promise<OrbitToolResult> {
  switch (params.name) {
    case "orbit_query": {
      rejectIfStrictProjectScope("orbit_query");
      const args = OrbitQuerySchema.parse(params.arguments);
      const result = await orbitQuery(args.query, args.format);
      const text = typeof result === "string" ? result : JSON.stringify(result);
      return { content: [{ type: "text", text }] };
    }

    case "orbit_get_schema": {
      rejectIfStrictProjectScope("orbit_get_schema");
      OrbitSchemaSchema.parse(params.arguments);
      const result = await orbitGetSchema();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "orbit_get_status": {
      rejectIfStrictProjectScope("orbit_get_status");
      OrbitStatusSchema.parse(params.arguments);
      const result = await orbitGetStatus();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "orbit_list_tools": {
      rejectIfStrictProjectScope("orbit_list_tools");
      OrbitToolsSchema.parse(params.arguments);
      const result = await orbitListTools();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    default:
      throw new Error(`Unknown tool: ${params.name}`);
  }
}
