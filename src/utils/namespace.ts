import { enhancedFetch } from "./fetch";

/**
 * Simple heuristic to determine if a path likely represents a project
 * Projects typically contain a slash (group/project), while groups usually don't
 */
export function isLikelyProjectPath(namespacePath: string): boolean {
  return namespacePath.includes("/");
}

/**
 * Detect namespace type by attempting to fetch from GitLab API
 * Tries both project and group endpoints to determine which one exists
 */
export async function detectNamespaceType(namespacePath: string): Promise<"project" | "group"> {
  // First try heuristic for common cases
  if (isLikelyProjectPath(namespacePath)) {
    // Try project first, fallback to group if needed
    const isProject = await verifyNamespaceType(namespacePath, "project");
    if (isProject) return "project";

    const isGroup = await verifyNamespaceType(namespacePath, "group");
    if (isGroup) return "group";

    // Default fallback for paths with slash
    return "project";
  } else {
    // Try group first, fallback to project if needed
    const isGroup = await verifyNamespaceType(namespacePath, "group");
    if (isGroup) return "group";

    const isProject = await verifyNamespaceType(namespacePath, "project");
    if (isProject) return "project";

    // Default fallback for paths without slash
    return "group";
  }
}

/**
 * Verify if a namespace exists as the specified type by making a lightweight API call
 */
async function verifyNamespaceType(
  namespacePath: string,
  type: "project" | "group"
): Promise<boolean> {
  try {
    const entityType = type === "project" ? "projects" : "groups";
    const apiUrl = `${process.env.GITLAB_API_URL}/api/v4/${entityType}/${encodeURIComponent(namespacePath)}`;

    const response = await enhancedFetch(apiUrl);

    return response.ok;
  } catch {
    // If API call fails, return false
    return false;
  }
}

/**
 * Determine the appropriate entity type and path for GitLab API calls
 * Returns the entity type ('projects' or 'groups') and ensures proper encoding
 */
export async function resolveNamespaceForAPI(namespacePath: string): Promise<{
  entityType: "projects" | "groups";
  encodedPath: string;
}> {
  const namespaceType = await detectNamespaceType(namespacePath);
  return {
    entityType: namespaceType === "project" ? "projects" : "groups",
    encodedPath: encodeURIComponent(namespacePath),
  };
}
