export const TOOL_PROFILES = ["full", "slim"] as const;

export type ToolProfile = (typeof TOOL_PROFILES)[number];

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
