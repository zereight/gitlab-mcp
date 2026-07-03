/**
 * Fields GitLab returns that are live credentials or carry embedded secrets.
 * MCP tool results become part of the AI conversation context, so these must
 * never be forwarded to the model.
 */
const SENSITIVE_GITLAB_FIELDS = ["runners_token", "import_url"] as const;

/**
 * Strip known sensitive fields from a GitLab API response object before it is
 * returned as an MCP tool result. Mutates and returns the same object.
 *
 * Used for raw passthrough responses (get_project / update_project) that do not
 * go through a Zod schema, since Zod would otherwise strip unknown keys for us.
 */
export function redactSensitiveGitLabFields<T>(data: T): T {
  if (data && typeof data === "object") {
    for (const key of SENSITIVE_GITLAB_FIELDS) {
      delete (data as Record<string, unknown>)[key];
    }
  }
  return data;
}
