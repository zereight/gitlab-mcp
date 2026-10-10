/**
 * Fields GitLab returns that are live credentials or carry embedded secrets.
 * MCP tool results become part of the AI conversation context, so these must
 * never be forwarded to the model.
 */
const SENSITIVE_GITLAB_FIELDS = ["runners_token", "import_url", "token"] as const;

/**
 * Strip known sensitive fields from a GitLab API response object before it is
 * returned as an MCP tool result. Mutates and returns the same object.
 * Recurses into arrays (e.g. list responses) since those hold one object per item.
 *
 * Used for raw passthrough responses (get_project / update_project,
 * list/get_pipeline_trigger) that do not go through a Zod schema, since Zod
 * would otherwise strip unknown keys for us. Do NOT apply to
 * create_pipeline_trigger: its response carries the newly issued token once.
 */
export function redactSensitiveGitLabFields<T>(data: T): T {
  if (Array.isArray(data)) {
    for (const item of data) redactSensitiveGitLabFields(item);
  } else if (data && typeof data === "object") {
    for (const key of SENSITIVE_GITLAB_FIELDS) {
      delete (data as Record<string, unknown>)[key];
    }
  }
  return data;
}

const SENSITIVE_ASSIGNMENT_PATTERN =
  /(["']?\b(?:runners_token|import_url|token)\b["']?\s*[:=]\s*)(?:"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'|\S+)/gi;

const GITLAB_TOKEN_PATTERN = /\bgl(?:pat|dt|rt|pt|ft|oas|soat)-[A-Za-z0-9._-]+/gi;

/**
 * Redacts the same secret fields when GitLab returns a non-JSON body.
 * JSON responses keep using {@link redactSensitiveGitLabFields}.
 */
export function redactSensitiveGitLabText(text: string): string {
  return text
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, "$1[REDACTED]")
    .replace(GITLAB_TOKEN_PATTERN, "[REDACTED]");
}
