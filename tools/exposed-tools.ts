import { isExcludedBySlimProfile } from "./tool-profile.js";

export interface ExposedToolSelection<T extends { readonly name: string }> {
  readonly tools: readonly T[];
  readonly isInEnabledToolset: (toolName: string) => boolean;
  readonly individuallyEnabledTools: ReadonlySet<string>;
  readonly featureFlagOverrides: ReadonlySet<string>;
  readonly isAllowedByPermissionMode: (toolName: string) => boolean;
  readonly deniedToolsRegex: RegExp | undefined;
  readonly hiddenToolNames: ReadonlySet<string>;
  readonly applySlimProfile: boolean;
}

export function selectExposedTools<T extends { readonly name: string }>(
  input: ExposedToolSelection<T>
): T[] {
  const toolsAfterToolsets = input.tools.filter(tool => input.isInEnabledToolset(tool.name));
  const toolsetToolNames = new Set(toolsAfterToolsets.map(tool => tool.name));
  const toolsAfterIndividual = [
    ...toolsAfterToolsets,
    ...input.tools.filter(
      tool => input.individuallyEnabledTools.has(tool.name) && !toolsetToolNames.has(tool.name)
    ),
  ];
  const afterIndividualNames = new Set(toolsAfterIndividual.map(tool => tool.name));
  const toolsAfterLegacy = [
    ...toolsAfterIndividual,
    ...input.tools.filter(
      tool => input.featureFlagOverrides.has(tool.name) && !afterIndividualNames.has(tool.name)
    ),
  ];
  const toolsAfterPermission = toolsAfterLegacy.filter(tool =>
    input.isAllowedByPermissionMode(tool.name)
  );
  const deniedToolsRegex = input.deniedToolsRegex;
  const toolsAfterRegex = deniedToolsRegex
    ? toolsAfterPermission.filter(tool => !deniedToolsRegex.test(tool.name))
    : [...toolsAfterPermission];

  const filteredToolNames = new Set(toolsAfterRegex.map(tool => tool.name));
  const discoverTool = input.tools.find(tool => tool.name === "discover_tools");
  if (discoverTool && !filteredToolNames.has("discover_tools")) {
    const passesPermissionMode = input.isAllowedByPermissionMode("discover_tools");
    const passesRegex = deniedToolsRegex ? !deniedToolsRegex.test("discover_tools") : true;
    if (passesPermissionMode && passesRegex) {
      toolsAfterRegex.push(discoverTool);
    }
  }

  const withoutHidden =
    input.hiddenToolNames.size > 0
      ? toolsAfterRegex.filter(tool => !input.hiddenToolNames.has(tool.name))
      : toolsAfterRegex;

  if (!input.applySlimProfile) {
    return withoutHidden;
  }

  return withoutHidden.filter(
    tool => !isExcludedBySlimProfile(tool.name, true, input.individuallyEnabledTools)
  );
}
