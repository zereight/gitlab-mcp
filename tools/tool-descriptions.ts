const TOOL_GUIDANCE: Readonly<Record<string, string>> = {
  merge_merge_request:
    "Use this only after checking approval, conflicts, and pipeline state; use `approve_merge_request` to approve rather than merge. Pass `sha` from `get_merge_request`; GitLab 19.2+ groups may reject merges without it.",
  approve_merge_request:
    "Record an approval on an existing merge request. It does not merge or change the source branch.",
  unapprove_merge_request:
    "Remove the current user's approval. Use `merge_merge_request` only when you intend to merge.",
  rebase_merge_request:
    "Rebase the source onto the target (force-push). With `wait` true (default) it returns `previous_sha` and `head_changed`; `merge_error` can be stale. Use `get_merge_request_conflicts` for conflicts.",
  get_merge_request_approval_state:
    "Inspect approval rules and approvers before merging. Use `approve_merge_request` to change approval state.",
  get_merge_request_conflicts:
    "Inspect merge conflicts before `merge_merge_request`. It reports conflicts and does not resolve them.",
  list_merge_request_pipelines:
    "List pipelines for one merge request. Use `list_pipelines` for project-wide filtering.",
  create_or_update_file:
    "Create or update one repository file. Use `push_files` for a multi-file commit. Optional `encoding` (`text` or `base64`) defaults to `GITLAB_REPO_FILE_ENCODING`.",
  push_files:
    "Commit several file changes atomically. Each file defaults to action `create`; optional per-file `action` (create/update/delete/move) and `encoding` (text/base64) are additive. `GITLAB_PERMISSION_MODE=modify` rejects `delete` and `move`.",
  create_issue:
    "Open a new issue. Use `update_issue` for an existing issue and `create_issue_note` for discussion.",
  list_issues:
    "Use this for issue management: list GitLab issues, optionally scoped with `project_id`. Use `get_issue` when the iid is known and `my_issues` for the current user's assignments.",
  my_issues:
    "Use this for issue management: list issues assigned to the authenticated user. Use `list_issues` for project-wide listing and `get_issue` for one issue. Requires classic read_user or fine-grained User:Read.",
  get_issue:
    "Use this for issue management: inspect one issue. Use `list_issues` or `my_issues` to discover issues first.",
  create_merge_request:
    "Open a merge request from an existing source branch to a target. Use `update_merge_request` after it exists.",
  fork_repository:
    "Fork an existing project into the current user's namespace or a permitted namespace. Use `search_repositories` or `get_project` to inspect without copying.",
  create_branch:
    "Create a branch from a source branch, tag, or commit. Use `protect_branch` after creation. Returns already-exists when the name is taken.",
  delete_branch:
    "Permanently delete a remote branch. Confirm the name first with `get_branch` or `list_branches`; this does not remove branch protection.",
  protect_branch:
    "Create a protection rule; GitLab returns 409 if one exists. Use `update_protected_branch` to change an existing rule.",
  update_protected_branch:
    "Change an existing protection rule in place (do not unprotect first). Read record `id`s with `get_protected_branch`. In `allowed_to_push`, `allowed_to_merge`, and `allowed_to_unprotect`, add with `access_level`, `user_id`, `group_id`, or `deploy_key_id` (push only); change with `id`; remove with `{id, _destroy: true}`. `member_role_id` is not supported. A request that would leave `allowed_to_unprotect` empty is refused. GitLab may reject the update unless the caller is on the current unprotect list.",
  unprotect_branch:
    "Remove protection. Use `update_protected_branch` to change access levels without removing the rule.",
  protect_tag:
    "Protect a tag or wildcard such as `v*` so protected CI/CD variables reach tag pipelines. Inspect first with `get_protected_tag` or `list_protected_tags`.",
  unprotect_tag:
    "Remove tag protection. To change create access, `unprotect_tag` then `protect_tag`. Blocked in `modify` mode.",
  update_default_branch:
    "Change the project's default branch. Use `create_branch` to create a branch rather than changing defaults.",
  create_note:
    "Add a top-level comment on an issue or merge request. Use `create_merge_request_thread` or `create_issue_note` for typed discussion.",
  create_merge_request_thread:
    "Start a review thread. Use `create_merge_request_note` for an unthreaded note and `create_merge_request_discussion_note` to reply.",
  resolve_merge_request_thread:
    "Mark an existing review thread resolved. Use `update_merge_request_discussion_note` to change note text.",
  mr_discussions: "List complete discussion threads. Use `get_merge_request_notes` for flat notes.",
  get_merge_request_discussion:
    "Fetch one discussion by id. Use `mr_discussions` for a collection and `get_merge_request_note` for a flat note.",
  create_merge_request_discussion_note:
    "Reply inside an existing discussion. Use `create_merge_request_thread` to start a thread and `create_merge_request_note` for a top-level note.",
  get_merge_request_note:
    "Fetch one note by id. Use `get_merge_request_notes` for a collection and `mr_discussions` for threads.",
  get_merge_request_notes:
    "List flat notes. Use `mr_discussions` when thread structure and resolution state are required.",
  create_issue_note:
    "Add a note to an existing issue, optionally as a reply. Use `update_issue` for issue fields.",
  list_issue_discussions:
    "List threaded discussions for an issue. Use `list_issues` or `get_issue` for issue records.",
  update_issue:
    "Change fields on an existing issue. Use `update_issue_description_patch` for a targeted description edit and `create_issue_note` for discussion.",
  delete_issue:
    "Permanently delete an issue. Use `update_issue` to close or edit without deleting.",
  delete_issue_link:
    "Remove a relationship between two issues. Verify first with `list_issue_links` or `get_issue_link`.",
  download_job_artifacts:
    "Retrieve a job artifact archive. Remote HTTP returns a download URL; local stdio saves a file (rejected in readonly mode).",
  download_attachment:
    "Retrieve a project attachment. Remote HTTP returns inline base64 or a URL; local stdio saves under GITLAB_DOWNLOAD_DIR and never overwrites.",
  gitlab_api_request:
    "Send one GitLab REST call under /api/v4. Readonly allows GET only; modify rejects DELETE. Enable only by listing api in GITLAB_TOOLSETS; all, discover_tools, and GITLAB_TOOLS do not. Prompt injection can drive this tool, so operators who rely on group, project, or tool restrictions must not enable it. With GITLAB_ALLOWED_PROJECT_IDS or a session project scope, only /projects/:id paths for an allowed project are accepted; body and query parameters that name another project are not checked.",
  execute_graphql:
    "Use only when no typed REST tool covers the operation. The query is sent directly and may include mutations.",
  whoami:
    "Requires classic read_user or fine-grained User:Read. Use `get_user` or `get_users` to look up another user.",
  list_project_members:
    "Search project members by name or username. Use `list_group_members` for a group.",
  get_commit_diff:
    "Return the file diffs for one commit. Use `get_commit` for metadata without the patch.",
  list_project_runners:
    "List runners a project can use, including ancestor group and allowed instance runners. Payload omits tags — call `get_runner` for tag_list. Never returns runners_token or the runner authentication token.",
  get_runner:
    "Get tag_list, run_untagged, locked, and access_level for a runner id. With GITLAB_ALLOWED_PROJECT_IDS or a session project scope, the runner must appear on an allowed project's list — pass project_id when more than one project is allowed. Never returns runners_token or the runner authentication token; token_expires_at is expiry metadata, not the token.",
  list_pipeline_schedules:
    "List scheduled pipelines (`cron`, `next_run_at`, `active`). The list has no `variables` — call `get_pipeline_schedule` for those.",
  get_pipeline_schedule:
    "Inspect one schedule including variables and inputs (Maintainer/Owner/schedule owner only).",
  list_pipeline_schedule_pipelines:
    "List pipelines a schedule has triggered. Use `get_pipeline` for one pipeline and `list_pipelines` for project-wide filtering.",
  create_pipeline_schedule:
    "Add a recurring pipeline. Prefer a full ref such as `refs/heads/main` when a branch and tag share a name. `cron_timezone` defaults to UTC.",
  update_pipeline_schedule:
    "Change an existing schedule. Call `take_ownership_pipeline_schedule` first when the schedule belongs to another user.",
  delete_pipeline_schedule:
    "Permanently remove a schedule and its variables. Pause with `update_pipeline_schedule` `active: false` instead when possible.",
  play_pipeline_schedule:
    "Run a schedule immediately without shifting `next_run_at`. Rate-limited to once per minute per schedule.",
  take_ownership_pipeline_schedule:
    "Transfer schedule ownership to the current user. Required before updating or deleting someone else's schedule.",
  get_pipeline_schedule_variable:
    "Read one schedule variable by key. Separate from project-level CI/CD variables.",
  create_pipeline_schedule_variable:
    "Attach a new variable to a schedule. `variable_type` defaults to `env_var`; `key` is /[a-zA-Z0-9_]+/ up to 255 characters.",
  update_pipeline_schedule_variable: "Change the value or type of an existing schedule variable.",
  delete_pipeline_schedule_variable:
    "Permanently remove a schedule variable. Later scheduled pipelines no longer receive it.",
  stop_stale_environments:
    "Stop eligible stale environments. GitLab excludes protected environments; this does not delete them.",
  delete_review_app_environments:
    "Schedule deletion of stopped review-app environments one week later. `dry_run` defaults to true.",
  orbit_query:
    "Answer cross-project relationship questions in one call. Premium/Ultimate; each call consumes GitLab credits. Use `orbit_get_schema` first when types are unknown.",
  orbit_get_schema:
    "List node and edge types for `orbit_query`. Read-only and free of credit charges.",
  orbit_get_status:
    "Check whether Orbit indexing has completed. Results reflect the last index cycle.",
  orbit_list_tools:
    "List MCP tool definitions Orbit itself exposes. Use `orbit_query` to run graph queries.",
};

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Candidate get_* names for a list_* resource: list_pipelines -> get_pipeline,
// list_branches -> get_branch, list_policies -> get_policy, list_diffs -> get_diffs.
function matchingGetToolNames(resource: string): string[] {
  const candidates = [`get_${resource}`];
  if (resource.endsWith("ies")) candidates.push(`get_${resource.slice(0, -3)}y`);
  if (resource.endsWith("es")) candidates.push(`get_${resource.slice(0, -2)}`);
  if (resource.endsWith("s")) candidates.push(`get_${resource.slice(0, -1)}`);
  return candidates;
}

// Candidate list_*/search_* names for a get_* resource: get_pipeline -> list_pipelines,
// get_branch -> list_branches, get_policy -> list_policies, get_diffs -> list_diffs.
function matchingDiscoveryToolNames(resource: string): string[] {
  const plurals = [resource, `${resource}s`, `${resource}es`];
  if (resource.endsWith("y")) plurals.push(`${resource.slice(0, -1)}ies`);
  return plurals.flatMap(plural => [`list_${plural}`, `search_${plural}`]);
}

// Sibling hints are only added when the sibling tool exists, so a description
// never points at a tool the server does not have.
function getLifecycleGuidance(name: string, toolNames: ReadonlySet<string>): string {
  const verb = name.split("_")[0] ?? "use";
  const resource = name.slice(verb.length + 1);

  if (verb === "list") {
    return matchingGetToolNames(resource).some(candidate => toolNames.has(candidate))
      ? "For one known resource, use the matching get tool."
      : "";
  }
  if (verb === "get") {
    return matchingDiscoveryToolNames(resource).some(candidate => toolNames.has(candidate))
      ? "To find resources, use the matching list or search tool."
      : "";
  }
  if (verb === "create") {
    return toolNames.has(`update_${resource}`) || toolNames.has(`edit_${resource}`)
      ? "If the resource already exists, use the update tool."
      : "";
  }
  if (verb === "update" || verb === "edit") {
    if (!toolNames.has(`create_${resource}`)) {
      return "";
    }
    return toolNames.has(`create_${resource}_note`)
      ? "Use the create tool for new resources and a note tool for comments."
      : "Use the create tool for new resources.";
  }
  if (verb === "delete" || verb === "remove") {
    return "Verify the target first with a get or list tool.";
  }
  if (verb === "search") {
    return "If the identifier is known, use a typed get or list tool.";
  }
  if (verb === "validate") {
    return "Checks without applying; create or update only after it passes.";
  }

  return "";
}

export function getToolDescription(
  name: string,
  baseDescription: string,
  toolNames: ReadonlySet<string>
): string {
  const explicitGuidance = TOOL_GUIDANCE[name];
  if (explicitGuidance) {
    return `${ensureSentence(baseDescription)} ${explicitGuidance}`;
  }

  const normalizedDescription = ensureSentence(baseDescription);
  const lifecycle = getLifecycleGuidance(name, toolNames);
  return lifecycle ? `${normalizedDescription} ${lifecycle}` : normalizedDescription;
}
