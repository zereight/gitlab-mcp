import {
  GITLAB_TOOL_POLICY_APPROVE_RAW,
  GITLAB_TOOL_POLICY_HIDDEN_RAW,
  GITLAB_TOOLS_RAW,
  GITLAB_TOOLSETS_RAW,
  getConfig,
} from "../config.js";
import { compileDeniedToolsRegex } from "../tools/denied-regex.js";
import {
  buildFeatureFlagOverrides,
  isToolInEnabledToolset,
  parseEnabledToolsets,
  parseIndividualTools,
  type ToolsetId,
} from "../tools/registry.js";

export interface ToolExposureInput {
  readonly toolName: string;
  readonly enabledToolsets: ReadonlySet<ToolsetId>;
  readonly individuallyEnabledTools: ReadonlySet<string>;
  readonly featureFlagOverrides: ReadonlySet<string>;
  readonly deniedRegex: RegExp | undefined;
  readonly hiddenTools: ReadonlySet<string>;
}

export interface CliExposure {
  isExposed(toolName: string): boolean;
  needsConfirmation(toolName: string): boolean;
  exposureRefusal(toolName: string): string | undefined;
}

export function parseToolNameSet(raw: string | undefined): ReadonlySet<string> {
  if (!raw || raw.trim() === "") {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map(name => name.trim())
      .filter(Boolean)
  );
}

export function isToolExposed(input: ToolExposureInput): boolean {
  if (input.hiddenTools.has(input.toolName)) {
    return false;
  }
  if (input.deniedRegex?.test(input.toolName) === true) {
    return false;
  }
  if (isToolInEnabledToolset(input.toolName, input.enabledToolsets)) {
    return true;
  }
  if (input.individuallyEnabledTools.has(input.toolName)) {
    return true;
  }
  return input.featureFlagOverrides.has(input.toolName);
}

export function exposureRefusalMessage(input: ToolExposureInput): string | undefined {
  if (input.hiddenTools.has(input.toolName)) {
    return `${input.toolName} is hidden by GITLAB_TOOL_POLICY_HIDDEN`;
  }
  if (input.deniedRegex?.test(input.toolName) === true) {
    return `${input.toolName} is blocked by GITLAB_DENIED_TOOLS_REGEX`;
  }
  if (isToolExposed(input)) {
    return undefined;
  }
  return `${input.toolName} is not enabled by GITLAB_TOOLSETS, GITLAB_TOOLS, or legacy wiki/milestone/pipeline flags`;
}

export function liveCliExposure(): CliExposure {
  const enabledToolsets = parseEnabledToolsets(GITLAB_TOOLSETS_RAW);
  const individuallyEnabledTools = parseIndividualTools(GITLAB_TOOLS_RAW);
  const featureFlagOverrides = buildFeatureFlagOverrides();
  const deniedRegex = compileDeniedToolsRegex(
    getConfig("denied-tools-regex", "GITLAB_DENIED_TOOLS_REGEX")
  ).regex;
  const hiddenTools = parseToolNameSet(GITLAB_TOOL_POLICY_HIDDEN_RAW);
  const approveTools = parseToolNameSet(GITLAB_TOOL_POLICY_APPROVE_RAW);

  return {
    isExposed(toolName: string): boolean {
      return isToolExposed({
        toolName,
        enabledToolsets,
        individuallyEnabledTools,
        featureFlagOverrides,
        deniedRegex,
        hiddenTools,
      });
    },
    needsConfirmation(toolName: string): boolean {
      return approveTools.has(toolName);
    },
    exposureRefusal(toolName: string): string | undefined {
      return exposureRefusalMessage({
        toolName,
        enabledToolsets,
        individuallyEnabledTools,
        featureFlagOverrides,
        deniedRegex,
        hiddenTools,
      });
    },
  };
}
