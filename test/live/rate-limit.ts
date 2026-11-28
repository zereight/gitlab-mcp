/**
 * GitLab.com rate-limits each user's whole API (100 requests a minute on the Free
 * plan). The live suite spends one token on direct REST calls and on the MCP servers
 * it spawns, so a run can hit 429. These helpers wait out a 429 and send again, within
 * fixed bounds. Every other response, error result, or thrown error comes back from
 * the first attempt unchanged, so a real failure still fails the test.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const MAX_ATTEMPTS = 5;
export const MAX_WAIT_MS = 30_000;
// 5 minute ceiling: give up instead of sleeping out a longer advertised wait,
// so CI cannot hang.
export const MAX_TOTAL_WAIT_MS = 5 * 60_000;

// A rate-limited tool result may not say how long to wait; these are the fallbacks.
const TOOL_RETRY_WAITS_MS = [15_000, 30_000, 30_000];

// Where the server puts the GitLab status and Retry-After of an error result.
const HTTP_ERROR_META = "io.github.zereight.gitlab-mcp/http-error";

// How the server words a GitLab 429 (handleGitLabError, executeGraphQL). Anchored:
// a bare "429" could be an issue iid or project ID inside an unrelated error.
const RATE_LIMIT_TEXT =
  /GitLab API error: 429\b|GraphQL request failed \(429\)|\bToo Many Requests\b|\bRate limit exceeded\b/i;

export interface BackoffIo {
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  now?: () => number;
}

function resolveIo(io: BackoffIo) {
  return {
    sleep: io.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms))),
    log: io.log ?? (line => process.stderr.write(`${line}\n`)),
    now: io.now ?? Date.now,
  };
}

// Retry-After is seconds or an HTTP date; NaN when absent or unreadable.
function retryAfterMs(value: string | null | undefined, now: number): number {
  if (value === null || value === undefined || value.trim() === "") return Number.NaN;
  const seconds = Number(value);
  return Number.isNaN(seconds) ? Date.parse(value) - now : seconds * 1000;
}

export function retryDelayMs(response: Response, attempt: number, now: number): number {
  let ms = retryAfterMs(response.headers.get("retry-after"), now);
  const reset = response.headers.get("ratelimit-reset");
  if (Number.isNaN(ms) && reset !== null && reset.trim() !== "") {
    ms = Number(reset) * 1000 - now;
  }
  if (Number.isNaN(ms)) ms = 1000 * 2 ** attempt;
  return Math.max(ms, 0);
}

// Sleep out the whole wait in chunks of at most MAX_WAIT_MS.
export async function sleepInChunks(
  ms: number,
  sleep: (ms: number) => Promise<void>
): Promise<void> {
  let remaining = ms;
  do {
    const chunk = Math.min(remaining, MAX_WAIT_MS);
    await sleep(chunk);
    remaining -= chunk;
  } while (remaining > 0);
}

const seconds = (ms: number) => Math.ceil(ms / 1000);

/**
 * Calls `send` again after a 429, honoring Retry-After, then RateLimit-Reset, then
 * 2^attempt seconds. Returns the last 429 after MAX_ATTEMPTS, or as soon as the
 * waits would pass MAX_TOTAL_WAIT_MS. `send` builds a new request each time.
 */
export async function fetchWithBackoff(
  send: () => Promise<Response>,
  io: BackoffIo = {}
): Promise<Response> {
  const { sleep, log, now } = resolveIo(io);
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const response = await send();
    if (response.status !== 429) return response;
    if (attempt + 1 >= MAX_ATTEMPTS) {
      log(`GitLab returned 429 ${MAX_ATTEMPTS} times; giving up`);
      return response;
    }
    const wait = retryDelayMs(response, attempt, now());
    if (waited + wait > MAX_TOTAL_WAIT_MS) {
      log(`GitLab returned 429; a ${seconds(wait)}s wait passes the 5 minute ceiling; giving up`);
      return response;
    }
    log(`GitLab returned 429; retrying in ${seconds(wait)}s`);
    // Free the connection; the caller only reads the response it gets back.
    await response.body?.cancel().catch(() => undefined);
    await sleepInChunks(wait, sleep);
    waited += wait;
  }
}

/** StdioTestClient's shape; the SDK Client is accepted as well. */
export interface ToolCaller {
  callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(result: CallToolResult): string {
  return (result.content ?? []).map(part => (part.type === "text" ? part.text : "")).join("");
}

// execute_graphql returns a failed request as data, not isError:
// {"error":"GraphQL request failed: GitLab API error: 429 ..."}.
function isGraphqlRateLimitData(result: CallToolResult): boolean {
  if (result.content?.length !== 1) return false;
  const text = textOf(result);
  if (!text.startsWith('{"error":')) return false;
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      isRecord(parsed) &&
      Object.keys(parsed).length === 1 &&
      typeof parsed.error === "string" &&
      parsed.error.startsWith("GraphQL request failed: ") &&
      RATE_LIMIT_TEXT.test(parsed.error)
    );
  } catch {
    return false;
  }
}

// undefined: not a rate limit. Otherwise the Retry-After the server forwarded, if any.
function rateLimitOf(result: CallToolResult): { retryAfter?: string } | undefined {
  if (result.isError !== true) return isGraphqlRateLimitData(result) ? {} : undefined;
  const meta = result._meta?.[HTTP_ERROR_META];
  // A known HTTP status decides; the wording is only checked when there is none.
  if (isRecord(meta) && typeof meta.status === "number") {
    if (meta.status !== 429) return undefined;
    return { retryAfter: typeof meta.retryAfter === "string" ? meta.retryAfter : undefined };
  }
  return RATE_LIMIT_TEXT.test(textOf(result)) ? {} : undefined;
}

/**
 * client.callTool, called again when GitLab rate-limited it: an error result with
 * HTTP status 429 or 429 wording, or a thrown error with 429 wording. Waits the
 * forwarded Retry-After, else 15 s, then 30 s, for up to 3 retries. Any other result
 * or error, such as a refused stale last_commit_id, is returned or thrown from the
 * first call. GitLab refuses a 429 request without running it, so a mutation is safe
 * to send again.
 */
export async function callToolWithBackoff(
  client: ToolCaller | Client,
  name: string,
  args: Record<string, unknown> = {},
  io: BackoffIo = {}
): Promise<CallToolResult> {
  const { sleep, log, now } = resolveIo(io);
  const call = (): Promise<CallToolResult> =>
    client instanceof Client
      ? (client.callTool({ name, arguments: args }) as Promise<CallToolResult>)
      : client.callTool(name, args);
  let waited = 0;
  for (let retry = 0; ; retry++) {
    let last: { result: CallToolResult } | { error: unknown };
    let retryAfter: string | undefined;
    try {
      const result = await call();
      const limited = rateLimitOf(result);
      if (!limited) return result;
      last = { result };
      retryAfter = limited.retryAfter;
    } catch (error) {
      if (!(error instanceof Error && RATE_LIMIT_TEXT.test(error.message))) throw error;
      last = { error };
    }
    const settle = (): CallToolResult => {
      if ("error" in last) throw last.error;
      return last.result;
    };
    if (retry >= TOOL_RETRY_WAITS_MS.length) {
      log(`${name}: GitLab rate limit (429) after ${retry} retries; giving up`);
      return settle();
    }
    const advertised = retryAfterMs(retryAfter, now());
    const wait = Number.isNaN(advertised) ? TOOL_RETRY_WAITS_MS[retry] : Math.max(advertised, 0);
    if (waited + wait > MAX_TOTAL_WAIT_MS) {
      log(
        `${name}: GitLab rate limit (429); a ${seconds(wait)}s wait passes the 5 minute ceiling; giving up`
      );
      return settle();
    }
    log(`${name}: GitLab rate limit (429); retrying in ${seconds(wait)}s`);
    await sleepInChunks(wait, sleep);
    waited += wait;
  }
}
