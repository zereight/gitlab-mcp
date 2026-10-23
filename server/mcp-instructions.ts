/**
 * MCP initialize `instructions` — a short session briefing.
 * Keep this under MCP_INSTRUCTIONS_MAX_BYTES so the handshake stays cheap.
 */

export const MCP_INSTRUCTIONS_MAX_BYTES = 2048;

export const MCP_INSTRUCTIONS = [
  "GitLab MCP. Default list: 38 core tools plus discover_tools (39). Call help for workflows.",
  "MR review: list_merge_request_changed_files, then get_merge_request_file_diff for 3-5 files. Do not dump get_merge_request_diffs.",
  "project_id: numeric ID or URL-encoded path (group%2Fproject). MR !123 uses merge_request_iid=123.",
  "discover_tools: omit category to list; pass a category to activate for this session. api is explicit-only (GITLAB_TOOLSETS=api).",
  "Shrink results: pass jmespath on any tool. Set GITLAB_MCP_COMPACT_RESULTS for oversized replies. Paginate get_pipeline_job_output.",
  "Prefer typed tools over execute_graphql. Do not enable gitlab_api_request unless you accept allowlist and safety-check bypass. Prompt injection can drive it.",
  "Destructive tools change GitLab state. Use the CLI (zereight-mcp-gitlab) for full diffs, logs, and artifacts.",
].join("\n");
