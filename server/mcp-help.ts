import { z } from "zod";

export type HelpTopic =
  | "overview"
  | "code-review"
  | "merge-requests"
  | "issues"
  | "pipelines"
  | "search"
  | "token-saving";

export const HELP_TOPICS: [HelpTopic, ...HelpTopic[]] = [
  "overview",
  "code-review",
  "merge-requests",
  "issues",
  "pipelines",
  "search",
  "token-saving",
];

export const HelpInputSchema = z.object({
  topic: z
    .enum(HELP_TOPICS)
    .optional()
    .describe(
      "Guide to return. Omit for the overview and the list of topics. " +
        "Values: overview, code-review, merge-requests, issues, pipelines, search, token-saving."
    ),
});

export function isHelpTopic(value: string): value is HelpTopic {
  for (const topic of HELP_TOPICS) {
    if (topic === value) {
      return true;
    }
  }
  return false;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled help topic: ${String(value)}`);
}

const GUIDES: Record<HelpTopic, string> = {
  overview: [
    "GitLab MCP workflow guide. Default tools/list is 38 core tools plus discover_tools.",
    "Call help with topic: code-review, merge-requests, issues, pipelines, search, token-saving.",
    "Activate more categories with discover_tools. api is explicit-only (GITLAB_TOOLSETS=api).",
    "project_id is a numeric ID or URL-encoded path (group%2Fproject). MR !123 → merge_request_iid=123.",
  ].join("\n"),
  "code-review": [
    "Code review (2-step diffs):",
    "1. list_merge_request_changed_files — paths only, no diff text.",
    "2. get_merge_request_file_diff — 3-5 files per call.",
    "3. create_merge_request_thread or create_draft_note, then bulk_publish_draft_notes.",
    "Do not dump get_merge_request_diffs for a whole MR. Prefer jmespath on large results.",
  ].join("\n"),
  "merge-requests": [
    "MR lifecycle: create_merge_request → review → approve_merge_request → merge_merge_request.",
    "Lookup: project_id plus merge_request_iid (or source_branch).",
    "Inspect: get_merge_request, get_merge_request_approval_state, get_merge_request_conflicts.",
    "Discussions: mr_discussions, create_merge_request_thread, resolve_merge_request_thread.",
    "merge_merge_request needs merge permission and often sha from get_merge_request.",
  ].join("\n"),
  issues: [
    "Issues: list_issues (default scope is issues you created; use scope=all), my_issues, get_issue.",
    "Write: create_issue, update_issue, create_issue_note, list_issue_discussions.",
    "Small description edits: update_issue_description_patch instead of resending the full body.",
    "project_id is a numeric ID or URL-encoded path.",
  ].join("\n"),
  pipelines: [
    "Pipelines: discover_tools with category pipelines if those tools are hidden.",
    "list_pipelines / get_pipeline, then list_pipeline_jobs / get_pipeline_job.",
    "Logs: get_pipeline_job_output with pagination (page / per_page). Do not pull a whole trace.",
    "Create/retry/cancel: create_pipeline, retry_pipeline, cancel_pipeline (destructive).",
  ].join("\n"),
  search: [
    "search_repositories for projects. Code search: search_code, search_project_code, search_group_code",
    "(needs GitLab advanced search or Zoekt; enable the search toolset via discover_tools).",
    "If you already have an id or path, use get_project / get_issue / get_merge_request instead.",
  ].join("\n"),
  "token-saving": [
    "Do not dump get_merge_request_diffs for a whole MR. Use list_merge_request_changed_files",
    "then batched get_merge_request_file_diff.",
    "Pass jmespath on any tool to shrink JSON. GITLAB_MCP_COMPACT_RESULTS replaces oversized",
    "MCP replies with a preview plus a CLI command. Human CLI is never compacted.",
    "Paginate logs (get_pipeline_job_output) and list endpoints. Prefer typed tools over",
    "execute_graphql. Do not enable gitlab_api_request unless you accept its bypass risk.",
  ].join("\n"),
};

export function getWorkflowGuide(topic: HelpTopic = "overview"): string {
  switch (topic) {
    case "overview":
    case "code-review":
    case "merge-requests":
    case "issues":
    case "pipelines":
    case "search":
    case "token-saving":
      return GUIDES[topic];
    default:
      return assertNever(topic);
  }
}

export function readHelpTopic(value: unknown): HelpTopic | undefined | "invalid" {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "string" && isHelpTopic(value)) {
    return value;
  }
  return "invalid";
}

export function formatUnknownHelpTopic(value: unknown): string {
  return `Unknown help topic ${JSON.stringify(value)}. Available: ${HELP_TOPICS.join(", ")}`;
}
