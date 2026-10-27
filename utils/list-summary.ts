/** MCP-only argument; stripped before GitLab handlers run. */
export const LIST_SUMMARY_ARGUMENT = "summary";

const LIST_SUMMARY_FIELDS_HINT =
  "If true, return only high-signal fields (id, iid, title, state, labels, author.username, updated_at, web_url, …).";

export const LIST_SUMMARY_ARGUMENT_DESCRIPTION = `${LIST_SUMMARY_FIELDS_HINT} Default false keeps the full GitLab JSON.`;

/** Description used when GITLAB_MCP_LIST_SUMMARY_DEFAULT is on. */
export const LIST_SUMMARY_ARGUMENT_DEFAULT_TRUE_DESCRIPTION = `${LIST_SUMMARY_FIELDS_HINT} This server defaults to true; pass false for the full GitLab JSON.`;

const SUMMARY_FIELDS = [
  "id",
  "iid",
  "title",
  "name",
  "state",
  "status",
  "ref",
  "web_url",
  "path_with_namespace",
  "username",
  "short_id",
  "key",
  "tag_name",
  "slug",
  "filename",
  "new_path",
  "labels",
  "source_branch",
  "target_branch",
  "draft",
  "updated_at",
] as const;

/** Fields kept per note when a summarized item carries discussion `notes`. */
const NOTE_SUMMARY_FIELDS = ["body", "created_at", "resolved"] as const;

const NATIVE_SUMMARY_TOOLS = new Set(["list_webhook_events"]);

export function toolAcceptsDecoratedSummary(toolName: string): boolean {
  if (NATIVE_SUMMARY_TOOLS.has(toolName)) {
    return false;
  }
  return toolName.startsWith("list_") || toolName === "mr_discussions";
}

/** Tools whose omitted `summary` follows GITLAB_MCP_LIST_SUMMARY_DEFAULT (list_* and mr_discussions). */
export function toolUsesListSummaryDefault(toolName: string): boolean {
  return toolAcceptsDecoratedSummary(toolName);
}

export function readListSummaryRequested(
  args: Record<string, unknown> | undefined,
  defaultRequested = false
): boolean {
  const raw = args?.[LIST_SUMMARY_ARGUMENT];
  if (raw === undefined || raw === null) {
    return defaultRequested;
  }
  return raw === true || raw === "true";
}

export function omitListSummaryArgument(args: Record<string, unknown>): Record<string, unknown> {
  if (!(LIST_SUMMARY_ARGUMENT in args)) {
    return args;
  }
  const { [LIST_SUMMARY_ARGUMENT]: _omit, ...rest } = args;
  return rest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reduce a GitLab user object to `{ username }`; anything else is dropped. */
function summarizeUser(user: unknown): { username: string } | undefined {
  if (!isRecord(user) || typeof user.username !== "string") {
    return undefined;
  }
  return { username: user.username };
}

function summarizeNote(note: unknown): unknown {
  if (!isRecord(note)) {
    return note;
  }
  const summarized: Record<string, unknown> = {};
  const author = summarizeUser(note.author);
  if (author) {
    summarized.author = author;
  }
  for (const field of NOTE_SUMMARY_FIELDS) {
    if (field in note) {
      summarized[field] = note[field];
    }
  }
  return summarized;
}

function summarizeItem(item: unknown): unknown {
  if (!isRecord(item)) {
    return item;
  }
  const summarized: Record<string, unknown> = {};
  for (const field of SUMMARY_FIELDS) {
    if (field in item) {
      summarized[field] = item[field];
    }
  }
  const author = summarizeUser(item.author);
  if (author) {
    summarized.author = author;
  }
  if (Array.isArray(item.assignees)) {
    summarized.assignees = item.assignees.map(summarizeUser).filter(user => user !== undefined);
  }
  if (Array.isArray(item.notes)) {
    summarized.notes = item.notes.map(summarizeNote);
  }
  return Object.keys(summarized).length > 0 ? summarized : item;
}

export function summarizeListPayload(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(summarizeItem);
  }
  if (isRecord(data) && Array.isArray(data.items)) {
    return { ...data, items: data.items.map(summarizeItem) };
  }
  return data;
}

interface TextContentBlock {
  readonly type?: unknown;
  readonly text?: unknown;
}

function isTextContentBlock(value: unknown): value is TextContentBlock {
  return typeof value === "object" && value !== null;
}

export function applyListSummaryToToolResult<T extends { content?: unknown; isError?: boolean }>(
  result: T,
  requested: boolean
): T {
  if (!requested || result.isError) {
    return result;
  }
  if (!Array.isArray(result.content)) {
    return result;
  }
  const content = result.content.map(block => {
    if (!isTextContentBlock(block) || block.type !== "text" || typeof block.text !== "string") {
      return block;
    }
    try {
      const parsed: unknown = JSON.parse(block.text);
      return { ...block, text: JSON.stringify(summarizeListPayload(parsed)) };
    } catch {
      return block;
    }
  });
  return { ...result, content };
}
