/** MCP-only argument; stripped before GitLab handlers run. */
export const LIST_SUMMARY_ARGUMENT = "summary";

export const LIST_SUMMARY_ARGUMENT_DESCRIPTION =
  "If true, return only high-signal fields (id, iid, title, state, web_url, …). Default false keeps the full GitLab JSON.";

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
] as const;

const NATIVE_SUMMARY_TOOLS = new Set(["list_webhook_events"]);

export function toolAcceptsDecoratedSummary(toolName: string): boolean {
  if (NATIVE_SUMMARY_TOOLS.has(toolName)) {
    return false;
  }
  return toolName.startsWith("list_") || toolName === "mr_discussions";
}

export function readListSummaryRequested(args: Record<string, unknown> | undefined): boolean {
  if (!args) {
    return false;
  }
  const raw = args[LIST_SUMMARY_ARGUMENT];
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
