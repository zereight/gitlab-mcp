export const TOOL_PROFILES = ["full", "slim"] as const;

export type ToolProfile = (typeof TOOL_PROFILES)[number];

/**
 * Tools omitted from the initial list when `GITLAB_TOOL_PROFILE=slim` and
 * `GITLAB_TOOLSETS` is unset. `discover_tools` does not add them back.
 * `GITLAB_TOOLS` can still name one explicitly.
 */
export const SLIM_PROFILE_EXCLUDED_TOOLS: ReadonlySet<string> = new Set([
  "get_draft_note",
  "list_draft_notes",
  "create_draft_note",
  "update_draft_note",
  "delete_draft_note",
  "publish_draft_note",
  "bulk_publish_draft_notes",
  "list_merge_request_emoji_reactions",
  "list_merge_request_note_emoji_reactions",
  "create_merge_request_emoji_reaction",
  "delete_merge_request_emoji_reaction",
  "create_merge_request_note_emoji_reaction",
  "delete_merge_request_note_emoji_reaction",
  "list_issue_emoji_reactions",
  "list_issue_note_emoji_reactions",
  "create_issue_emoji_reaction",
  "delete_issue_emoji_reaction",
  "create_issue_note_emoji_reaction",
  "delete_issue_note_emoji_reaction",
  "list_labels",
  "get_label",
  "create_label",
  "update_label",
  "delete_label",
  "validate_ci_lint",
  "validate_project_ci_lint",
  "list_ci_catalog_resources",
  "get_ci_catalog_resource",
  "create_group",
]);

export function parseToolProfile(raw: string | undefined): ToolProfile {
  if (raw === undefined) {
    return "full";
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "" || normalized === "full") {
    return "full";
  }
  if (normalized === "slim") {
    return "slim";
  }
  throw new Error(
    `Invalid GITLAB_TOOL_PROFILE: "${raw}". Expected one of: ${TOOL_PROFILES.join(", ")}`
  );
}

/** Slim applies only when the caller did not pin an explicit toolset list. */
export function shouldApplySlimToolProfile(
  profile: ToolProfile,
  toolsetsRaw: string | undefined
): boolean {
  if (profile !== "slim") {
    return false;
  }
  return toolsetsRaw === undefined || toolsetsRaw.trim() === "";
}

export function isExcludedBySlimProfile(
  toolName: string,
  applySlimProfile: boolean,
  explicitlyEnabledTools: ReadonlySet<string>
): boolean {
  if (!applySlimProfile) {
    return false;
  }
  if (explicitlyEnabledTools.has(toolName)) {
    return false;
  }
  return SLIM_PROFILE_EXCLUDED_TOOLS.has(toolName);
}

export function isToolsetFullyActive(
  toolNames: Iterable<string>,
  activeToolNames: ReadonlySet<string>,
  isExcluded: (toolName: string) => boolean
): boolean {
  for (const toolName of toolNames) {
    if (activeToolNames.has(toolName) || isExcluded(toolName)) {
      continue;
    }
    return false;
  }
  return true;
}
