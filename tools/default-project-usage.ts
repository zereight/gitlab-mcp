/**
 * Declares which tools may have the server's default project injected into the
 * masking scope (see index.ts selectMaskingPolicy).
 *
 * The declaration lives here, not on the tool objects in tools/registry.ts, because
 * those objects are passed straight into the tools/list payload. Adding a field there
 * would change the schema the client sees. Nothing in this module is exposed to clients.
 *
 * Rules:
 * - A tool whose inputSchema requires project_id is always covered by the schema check.
 *   It needs no entry here.
 * - A tool with an optional project_id that can reach getEffectiveProjectId needs an entry,
 *   even "never". test/utils/default-project-usage-guard.test.ts enforces this.
 *
 * This module must not import index.ts.
 */

/**
 * - "always": the handler always resolves a project, so the default is always used.
 * - "whenProjectScopeConfigured": used when GITLAB_PROJECT_ID is set or a project allowlist is configured.
 * - "whenStrictScopeAndAllowlist": used when ENABLE_STRICT_PROJECT_SCOPE is on and an allowlist is configured.
 * - "never": the default is not supplied to masking, even if the handler can reach it.
 */
export type DefaultProjectUsage =
  "always" | "whenProjectScopeConfigured" | "whenStrictScopeAndAllowlist" | "never";

export const DEFAULT_PROJECT_USAGE_BY_TOOL: ReadonlyMap<string, DefaultProjectUsage> = new Map<
  string,
  DefaultProjectUsage
>([
  ["get_file_contents", "always"],
  ["my_issues", "whenProjectScopeConfigured"],
  ["list_issues", "whenStrictScopeAndAllowlist"],
  ["list_merge_requests", "whenStrictScopeAndAllowlist"],

  // Snippets: getSnippetsEndpoint() calls getEffectiveProjectId("") when a project
  // scope is active and project_id is absent, so the request can target the default
  // project's snippets while masking gets no default. This is a suspected pre-existing
  // gap. It is kept as on main and not fixed in this change.
  ["list_snippets", "never"],
  ["get_snippet", "never"],
  ["create_snippet", "never"],
  ["update_snippet", "never"],
  ["delete_snippet", "never"],

  // Webhooks: buildWebhookBaseUrl() reaches getEffectiveProjectId only when project_id
  // is given. When it is absent, the group endpoint is used and the default project is
  // never read.
  ["list_webhooks", "never"],
  ["create_webhook", "never"],
  ["update_webhook", "never"],
  ["delete_webhook", "never"],
  ["list_webhook_events", "never"],
  ["get_webhook_event", "never"],

  // get_runner: with GITLAB_PROJECT_ID set and project_id absent, getRunner() calls
  // getEffectiveProjectId("") only for an availability assertion. The response is the
  // runner's own detail, not project data, so no project scope is implied.
  ["get_runner", "never"],
]);

/** Inputs the decision depends on. Pass them as thunks where the read has side effects or can throw. */
export interface DefaultProjectContext {
  /** Boolean(GITLAB_PROJECT_ID). */
  readonly hasDefaultProject: boolean;
  /**
   * getEffectiveAllowedProjectIds().length > 0. This is a thunk because the allowlist is
   * read only where the expression reads it, and it reads the per-session store, so it
   * must run inside the same selectMaskingPolicy closure.
   */
  readonly hasAllowedProjectIds: () => boolean;
  /** ENABLE_STRICT_PROJECT_SCOPE. */
  readonly strictProjectScope: boolean;
}

/**
 * Whether the masking policy should be given the default project as a fallback scope.
 * This is a pure function of its inputs. It returns exactly what the expression in main's
 * selectMaskingPolicy returned, and it calls hasAllowedProjectIds() at the same points.
 */
export function toolUsesDefaultProject(
  toolName: string,
  inputSchema: { readonly required?: readonly string[] } | undefined,
  context: DefaultProjectContext
): boolean {
  if (inputSchema?.required?.includes("project_id")) return true;
  switch (DEFAULT_PROJECT_USAGE_BY_TOOL.get(toolName) ?? "never") {
    case "always":
      return true;
    case "whenProjectScopeConfigured":
      return context.hasDefaultProject || context.hasAllowedProjectIds();
    case "whenStrictScopeAndAllowlist":
      return context.strictProjectScope && context.hasAllowedProjectIds();
    case "never":
      return false;
  }
}
