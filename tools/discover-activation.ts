export interface DiscoverActivationSkip {
  readonly allowedByPermissionMode: boolean;
  readonly deniedByRegex: boolean;
  readonly hidden: boolean;
  readonly excludedBySlimProfile: boolean;
}

/**
 * Same skips `discover_tools` uses when it adds tools: permission mode, regex
 * denial, hidden policy, and the slim profile. Those tools never join the list.
 */
export function isSkippedByDiscoverActivation(input: DiscoverActivationSkip): boolean {
  if (!input.allowedByPermissionMode) {
    return true;
  }
  if (input.deniedByRegex) {
    return true;
  }
  if (input.hidden) {
    return true;
  }
  return input.excludedBySlimProfile;
}

export interface UnavailableToolMessageInput {
  readonly toolName: string;
  readonly toolset: string | undefined;
  readonly deniedByRegex: boolean;
  readonly excludedBySlimProfile: boolean;
  readonly enabledByCurrentToolsets: boolean;
}

/**
 * Hint for a direct call to a tool `tools/list` omitted.
 * `discover_tools` is mentioned only when activation would add the tool.
 */
export function buildUnavailableToolMessage(input: UnavailableToolMessageInput): string {
  const base = `Tool "${input.toolName}" is not available on this server`;
  const toolset = input.toolset;
  if (toolset === undefined || input.deniedByRegex) {
    return base;
  }
  if (input.excludedBySlimProfile) {
    return `${base}. ${slimExclusionGuidance(input.toolName, toolset, input.enabledByCurrentToolsets)}`;
  }
  return `${base}. It belongs to the "${toolset}" toolset, which is not enabled: call discover_tools with category "${toolset}" or add "${toolset}" to GITLAB_TOOLSETS.`;
}

function slimExclusionGuidance(
  toolName: string,
  toolset: string,
  enabledByCurrentToolsets: boolean
): string {
  const viaToolsets = `add "${toolset}" to GITLAB_TOOLSETS (setting GITLAB_TOOLSETS disables the slim profile)`;
  if (enabledByCurrentToolsets) {
    return `The slim tool profile excludes it. Add "${toolName}" to GITLAB_TOOLS, set GITLAB_TOOL_PROFILE=full, or ${viaToolsets}.`;
  }
  return `The slim tool profile excludes it. Add "${toolName}" to GITLAB_TOOLS, or ${viaToolsets}.`;
}
