import { CliUsageError } from "./args.js";

export type TableKind = "list" | "kv" | "text";

export interface TableSpec {
  readonly kind: TableKind;
  readonly columns?: readonly string[];
}

export interface ScopePair {
  readonly projectTool: string;
  readonly groupTool: string;
}

export interface CuratedCommand {
  readonly group: string;
  readonly action: string;
  readonly tool: string;
  readonly extraArgs?: Readonly<Record<string, string>>;
  readonly flagAliases?: Readonly<Record<string, string>>;
  readonly scope?: ScopePair;
  readonly table?: TableSpec;
}

const MR_IID = { mr_iid: "merge_request_iid", iid: "merge_request_iid" };
const ISSUE_IID = { issue_iid: "issue_iid", iid: "issue_iid" };
const BRANCH = { branch: "branch_name" };
const SOURCE_TARGET = { source: "source_branch", target: "target_branch" };

const LIST_MR: TableSpec = { kind: "list", columns: ["iid", "state", "title"] };
const KV_MR: TableSpec = { kind: "kv", columns: ["iid", "state", "title", "source_branch", "target_branch", "web_url"] };
const LIST_ISSUE: TableSpec = { kind: "list", columns: ["iid", "state", "title"] };
const KV_ISSUE: TableSpec = { kind: "kv", columns: ["iid", "state", "title", "web_url"] };
const LIST_PIPELINE: TableSpec = { kind: "list", columns: ["id", "status", "ref"] };
const KV_PIPELINE: TableSpec = { kind: "kv", columns: ["id", "status", "ref", "web_url"] };
const LIST_JOB: TableSpec = { kind: "list", columns: ["id", "name", "status"] };
const LIST_PROJECT: TableSpec = { kind: "list", columns: ["id", "path_with_namespace"] };
const KV_PROJECT: TableSpec = { kind: "kv", columns: ["id", "name", "path_with_namespace", "web_url"] };
const LIST_BRANCH: TableSpec = { kind: "list", columns: ["name", "merged", "protected"] };
const KV_BRANCH: TableSpec = { kind: "kv", columns: ["name", "merged", "protected", "default"] };
const LIST_COMMIT: TableSpec = { kind: "list", columns: ["short_id", "title", "author_name"] };
const KV_COMMIT: TableSpec = { kind: "kv", columns: ["id", "title", "author_name", "web_url"] };
const KV_USER: TableSpec = { kind: "kv", columns: ["id", "username", "name", "web_url"] };
const LIST_LABEL: TableSpec = { kind: "list", columns: ["id", "name", "color"] };
const LIST_RELEASE: TableSpec = { kind: "list", columns: ["tag_name", "name"] };
const LIST_TAG: TableSpec = { kind: "list", columns: ["name", "message"] };
const LIST_VAR: TableSpec = { kind: "list", columns: ["key", "protected", "masked"] };
const LIST_MILESTONE: TableSpec = { kind: "list", columns: ["iid", "title", "state"] };
const LIST_WIKI: TableSpec = { kind: "list", columns: ["slug", "title"] };
const LIST_WEBHOOK: TableSpec = { kind: "list", columns: ["id", "url"] };
const LIST_WORKITEM: TableSpec = { kind: "list", columns: ["iid", "title", "work_item_type"] };
const TEXT: TableSpec = { kind: "text" };

const GROUP_ALIASES: Readonly<Record<string, string>> = {
  mr: "mr",
  "merge-requests": "mr",
  issue: "issue",
  issues: "issue",
  pipeline: "pipeline",
  pipelines: "pipeline",
  project: "project",
  projects: "project",
  branch: "branch",
  branches: "branch",
  commit: "commit",
  commits: "commit",
  user: "user",
  users: "user",
  repo: "repo",
  repository: "repo",
  repositories: "repo",
  label: "label",
  labels: "label",
  release: "release",
  releases: "release",
  tag: "tag",
  tags: "tag",
  variable: "variable",
  variables: "variable",
  milestone: "milestone",
  milestones: "milestone",
  wiki: "wiki",
  group: "group",
  groups: "group",
  ci: "ci",
  webhook: "webhook",
  webhooks: "webhook",
  workitem: "workitem",
  workitems: "workitem",
  search: "search",
  vulnerability: "vulnerability",
  vulnerabilities: "vulnerability",
  "dependency-proxy": "dependency-proxy",
  orbit: "orbit",
};

export const CURATED_COMMANDS: readonly CuratedCommand[] = [
  // Phase 1 reads
  { group: "mr", action: "list", tool: "list_merge_requests", scope: { projectTool: "list_merge_requests", groupTool: "list_group_merge_requests" }, table: LIST_MR },
  { group: "mr", action: "view", tool: "get_merge_request", flagAliases: MR_IID, table: KV_MR },
  { group: "mr", action: "diff", tool: "get_merge_request_diffs", flagAliases: MR_IID, table: TEXT },
  { group: "mr", action: "files", tool: "list_merge_request_changed_files", flagAliases: MR_IID, table: { kind: "list", columns: ["new_path", "old_path"] } },
  { group: "mr", action: "discussions", tool: "mr_discussions", flagAliases: MR_IID, table: TEXT },
  { group: "mr", action: "pipelines", tool: "list_merge_request_pipelines", flagAliases: MR_IID, table: LIST_PIPELINE },
  { group: "mr", action: "approvals", tool: "get_merge_request_approval_state", flagAliases: MR_IID, table: TEXT },
  { group: "issue", action: "list", tool: "list_issues", table: LIST_ISSUE },
  { group: "issue", action: "mine", tool: "my_issues", table: LIST_ISSUE },
  { group: "issue", action: "view", tool: "get_issue", flagAliases: ISSUE_IID, table: KV_ISSUE },
  { group: "issue", action: "discussions", tool: "list_issue_discussions", flagAliases: ISSUE_IID, table: TEXT },
  { group: "pipeline", action: "list", tool: "list_pipelines", table: LIST_PIPELINE },
  { group: "pipeline", action: "view", tool: "get_pipeline", table: KV_PIPELINE },
  { group: "pipeline", action: "jobs", tool: "list_pipeline_jobs", table: LIST_JOB },
  { group: "pipeline", action: "log", tool: "get_pipeline_job_output", table: TEXT },
  { group: "project", action: "list", tool: "list_projects", table: LIST_PROJECT },
  { group: "project", action: "view", tool: "get_project", table: KV_PROJECT },
  { group: "branch", action: "list", tool: "list_branches", table: LIST_BRANCH },
  { group: "branch", action: "view", tool: "get_branch", flagAliases: BRANCH, table: KV_BRANCH },
  { group: "commit", action: "list", tool: "list_commits", table: LIST_COMMIT },
  { group: "commit", action: "view", tool: "get_commit", table: KV_COMMIT },
  { group: "user", action: "whoami", tool: "whoami", table: KV_USER },

  // Phase 2 writes + extra daily commands
  { group: "mr", action: "create", tool: "create_merge_request", flagAliases: SOURCE_TARGET, table: KV_MR },
  { group: "mr", action: "approve", tool: "approve_merge_request", flagAliases: MR_IID, table: KV_MR },
  { group: "mr", action: "unapprove", tool: "unapprove_merge_request", flagAliases: MR_IID, table: KV_MR },
  { group: "mr", action: "merge", tool: "merge_merge_request", flagAliases: MR_IID, table: KV_MR },
  { group: "mr", action: "note", tool: "create_merge_request_note", flagAliases: MR_IID, table: { kind: "kv", columns: ["id", "body", "created_at"] } },
  { group: "mr", action: "update", tool: "update_merge_request", flagAliases: MR_IID, table: KV_MR },
  { group: "issue", action: "create", tool: "create_issue", table: KV_ISSUE },
  { group: "issue", action: "close", tool: "update_issue", extraArgs: { state_event: "close" }, flagAliases: ISSUE_IID, table: KV_ISSUE },
  { group: "issue", action: "reopen", tool: "update_issue", extraArgs: { state_event: "reopen" }, flagAliases: ISSUE_IID, table: KV_ISSUE },
  { group: "issue", action: "update", tool: "update_issue", flagAliases: ISSUE_IID, table: KV_ISSUE },
  { group: "issue", action: "note", tool: "create_issue_note", flagAliases: ISSUE_IID, table: { kind: "kv", columns: ["id", "body"] } },
  { group: "issue", action: "delete", tool: "delete_issue", flagAliases: ISSUE_IID, table: TEXT },
  { group: "pipeline", action: "retry", tool: "retry_pipeline", table: KV_PIPELINE },
  { group: "pipeline", action: "cancel", tool: "cancel_pipeline", table: KV_PIPELINE },
  { group: "pipeline", action: "create", tool: "create_pipeline", table: KV_PIPELINE },
  { group: "pipeline", action: "delete", tool: "delete_pipeline", table: TEXT },
  { group: "pipeline", action: "job-retry", tool: "retry_pipeline_job", table: LIST_JOB },
  { group: "pipeline", action: "job-cancel", tool: "cancel_pipeline_job", table: LIST_JOB },
  { group: "pipeline", action: "job-play", tool: "play_pipeline_job", table: LIST_JOB },
  { group: "project", action: "members", tool: "list_project_members", table: { kind: "list", columns: ["id", "username", "access_level"] } },
  { group: "project", action: "update", tool: "update_project", table: KV_PROJECT },
  { group: "branch", action: "create", tool: "create_branch", table: KV_BRANCH },
  { group: "branch", action: "delete", tool: "delete_branch", flagAliases: BRANCH, table: TEXT },
  { group: "commit", action: "diff", tool: "get_commit_diff", table: TEXT },
  { group: "user", action: "list", tool: "get_users", table: { kind: "list", columns: ["id", "username", "name"] } },
  { group: "user", action: "view", tool: "get_user", table: KV_USER },
  { group: "user", action: "events", tool: "list_events", table: { kind: "list", columns: ["action_name", "target_type", "created_at"] } },
  { group: "repo", action: "search", tool: "search_repositories", table: LIST_PROJECT },
  { group: "repo", action: "tree", tool: "get_repository_tree", table: { kind: "list", columns: ["path", "type"] } },
  { group: "repo", action: "file", tool: "get_file_contents", table: TEXT },
  { group: "repo", action: "create", tool: "create_repository", table: KV_PROJECT },
  { group: "repo", action: "fork", tool: "fork_repository", table: KV_PROJECT },
  { group: "repo", action: "push", tool: "push_files", table: TEXT },
  { group: "label", action: "list", tool: "list_labels", table: LIST_LABEL },
  { group: "label", action: "view", tool: "get_label", table: { kind: "kv", columns: ["id", "name", "color", "description"] } },
  { group: "label", action: "create", tool: "create_label", table: LIST_LABEL },
  { group: "label", action: "update", tool: "update_label", table: LIST_LABEL },
  { group: "label", action: "delete", tool: "delete_label", table: TEXT },
  { group: "release", action: "list", tool: "list_releases", table: LIST_RELEASE },
  { group: "release", action: "view", tool: "get_release", table: { kind: "kv", columns: ["tag_name", "name", "description"] } },
  { group: "release", action: "create", tool: "create_release", table: LIST_RELEASE },
  { group: "release", action: "update", tool: "update_release", table: LIST_RELEASE },
  { group: "release", action: "delete", tool: "delete_release", table: TEXT },
  { group: "release", action: "download", tool: "download_release_asset", table: TEXT },
  { group: "tag", action: "list", tool: "list_tags", table: LIST_TAG },
  { group: "tag", action: "view", tool: "get_tag", table: { kind: "kv", columns: ["name", "message", "target"] } },
  { group: "tag", action: "create", tool: "create_tag", table: LIST_TAG },
  { group: "tag", action: "delete", tool: "delete_tag", table: TEXT },
  { group: "tag", action: "signature", tool: "get_tag_signature", table: TEXT },
  { group: "variable", action: "list", tool: "list_project_variables", scope: { projectTool: "list_project_variables", groupTool: "list_group_variables" }, table: LIST_VAR },
  { group: "variable", action: "view", tool: "get_project_variable", scope: { projectTool: "get_project_variable", groupTool: "get_group_variable" }, table: { kind: "kv", columns: ["key", "variable_type", "protected", "masked"] } },
  { group: "variable", action: "create", tool: "create_project_variable", scope: { projectTool: "create_project_variable", groupTool: "create_group_variable" }, table: LIST_VAR },
  { group: "variable", action: "update", tool: "update_project_variable", scope: { projectTool: "update_project_variable", groupTool: "update_group_variable" }, table: LIST_VAR },
  { group: "variable", action: "delete", tool: "delete_project_variable", scope: { projectTool: "delete_project_variable", groupTool: "delete_group_variable" }, table: TEXT },

  // Phase 3 remaining groups
  { group: "milestone", action: "list", tool: "list_milestones", scope: { projectTool: "list_milestones", groupTool: "list_group_milestones" }, table: LIST_MILESTONE },
  { group: "milestone", action: "view", tool: "get_milestone", scope: { projectTool: "get_milestone", groupTool: "get_group_milestone" }, table: { kind: "kv", columns: ["iid", "title", "state", "web_url"] } },
  { group: "milestone", action: "create", tool: "create_milestone", scope: { projectTool: "create_milestone", groupTool: "create_group_milestone" }, table: LIST_MILESTONE },
  { group: "milestone", action: "edit", tool: "edit_milestone", scope: { projectTool: "edit_milestone", groupTool: "edit_group_milestone" }, table: LIST_MILESTONE },
  { group: "milestone", action: "delete", tool: "delete_milestone", scope: { projectTool: "delete_milestone", groupTool: "delete_group_milestone" }, table: TEXT },
  { group: "milestone", action: "issues", tool: "get_milestone_issue", scope: { projectTool: "get_milestone_issue", groupTool: "get_group_milestone_issue" }, table: LIST_ISSUE },
  { group: "milestone", action: "mrs", tool: "get_milestone_merge_requests", scope: { projectTool: "get_milestone_merge_requests", groupTool: "get_group_milestone_merge_requests" }, table: LIST_MR },
  { group: "wiki", action: "list", tool: "list_wiki_pages", scope: { projectTool: "list_wiki_pages", groupTool: "list_group_wiki_pages" }, table: LIST_WIKI },
  { group: "wiki", action: "view", tool: "get_wiki_page", scope: { projectTool: "get_wiki_page", groupTool: "get_group_wiki_page" }, table: { kind: "kv", columns: ["slug", "title", "content"] } },
  { group: "wiki", action: "create", tool: "create_wiki_page", scope: { projectTool: "create_wiki_page", groupTool: "create_group_wiki_page" }, table: LIST_WIKI },
  { group: "wiki", action: "update", tool: "update_wiki_page", scope: { projectTool: "update_wiki_page", groupTool: "update_group_wiki_page" }, table: LIST_WIKI },
  { group: "wiki", action: "delete", tool: "delete_wiki_page", scope: { projectTool: "delete_wiki_page", groupTool: "delete_group_wiki_page" }, table: TEXT },
  { group: "group", action: "create", tool: "create_group", table: { kind: "kv", columns: ["id", "name", "full_path", "web_url"] } },
  { group: "ci", action: "lint", tool: "validate_ci_lint", table: TEXT },
  { group: "ci", action: "project-lint", tool: "validate_project_ci_lint", table: TEXT },
  { group: "ci", action: "catalog", tool: "list_ci_catalog_resources", table: { kind: "list", columns: ["id", "name"] } },
  { group: "ci", action: "catalog-view", tool: "get_ci_catalog_resource", table: TEXT },
  { group: "webhook", action: "list", tool: "list_webhooks", table: LIST_WEBHOOK },
  { group: "webhook", action: "create", tool: "create_webhook", table: LIST_WEBHOOK },
  { group: "webhook", action: "update", tool: "update_webhook", table: LIST_WEBHOOK },
  { group: "webhook", action: "delete", tool: "delete_webhook", table: TEXT },
  { group: "webhook", action: "events", tool: "list_webhook_events", table: TEXT },
  { group: "webhook", action: "event", tool: "get_webhook_event", table: TEXT },
  { group: "workitem", action: "list", tool: "list_work_items", table: LIST_WORKITEM },
  { group: "workitem", action: "view", tool: "get_work_item", table: { kind: "kv", columns: ["iid", "title", "web_url"] } },
  { group: "workitem", action: "create", tool: "create_work_item", table: LIST_WORKITEM },
  { group: "workitem", action: "update", tool: "update_work_item", table: LIST_WORKITEM },
  { group: "workitem", action: "convert", tool: "convert_work_item_type", table: LIST_WORKITEM },
  { group: "workitem", action: "move", tool: "move_work_item", table: LIST_WORKITEM },
  { group: "workitem", action: "notes", tool: "list_work_item_notes", table: TEXT },
  { group: "workitem", action: "note", tool: "create_work_item_note", table: TEXT },
  { group: "search", action: "code", tool: "search_code", table: TEXT },
  { group: "search", action: "project", tool: "search_project_code", table: TEXT },
  { group: "search", action: "group", tool: "search_group_code", table: TEXT },
  { group: "vulnerability", action: "list", tool: "list_project_vulnerabilities", table: TEXT },
  { group: "vulnerability", action: "view", tool: "get_vulnerability", table: TEXT },
  { group: "vulnerability", action: "dismiss", tool: "dismiss_vulnerability", table: TEXT },
  { group: "vulnerability", action: "confirm", tool: "confirm_vulnerability", table: TEXT },
  { group: "dependency-proxy", action: "settings", tool: "get_dependency_proxy_settings", table: TEXT },
  { group: "dependency-proxy", action: "update-settings", tool: "update_dependency_proxy_settings", table: TEXT },
  { group: "dependency-proxy", action: "blobs", tool: "list_dependency_proxy_blobs", table: TEXT },
  { group: "dependency-proxy", action: "purge", tool: "purge_dependency_proxy_cache", table: TEXT },
  { group: "orbit", action: "query", tool: "orbit_query", table: TEXT },
  { group: "orbit", action: "schema", tool: "orbit_get_schema", table: TEXT },
  { group: "orbit", action: "status", tool: "orbit_get_status", table: TEXT },
  { group: "orbit", action: "tools", tool: "orbit_list_tools", table: TEXT },
];

export function canonicalGroup(name: string): string | undefined {
  return GROUP_ALIASES[name];
}

export function isKnownCliCommand(name: string): boolean {
  return name === "auth" || name === "tool" || canonicalGroup(name) !== undefined;
}

export function findCuratedCommand(group: string, action: string): CuratedCommand | undefined {
  const canonical = canonicalGroup(group);
  if (canonical === undefined) {
    return undefined;
  }
  return CURATED_COMMANDS.find(command => command.group === canonical && command.action === action);
}

export function listGroupActions(group: string): readonly CuratedCommand[] {
  const canonical = canonicalGroup(group);
  if (canonical === undefined) {
    return [];
  }
  return CURATED_COMMANDS.filter(command => command.group === canonical);
}

export function listGroups(): readonly string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const command of CURATED_COMMANDS) {
    if (!seen.has(command.group)) {
      seen.add(command.group);
      groups.push(command.group);
    }
  }
  return groups;
}

export function resolveScopedTool(
  command: CuratedCommand,
  flags: Readonly<Record<string, string>>
): string {
  const scope = command.scope;
  if (scope === undefined) {
    return command.tool;
  }
  const hasGroup = flags.group_id !== undefined;
  const hasProject = flags.project_id !== undefined;
  if (hasGroup && hasProject) {
    throw new CliUsageError("use --project-id or --group-id, not both");
  }
  if (hasGroup) {
    return scope.groupTool;
  }
  return scope.projectTool;
}
