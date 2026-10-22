const TOOL_GUIDANCE: Readonly<Record<string, string>> = {
  merge_merge_request:
    "Use this only after checking the merge request approval, conflict, and pipeline state; use `approve_merge_request` to approve rather than merge. The operation changes repository state and may squash commits, schedule auto-merge, or delete the source branch, so it requires merge permission and returns GitLab's merge result or a mergeability error. Pass `sha` from `get_merge_request` (`sha` or `diff_refs.head_sha`); GitLab 19.2+ groups may reject merges without it.",
  approve_merge_request:
    "Use this to record an approval on an existing merge request; it does not merge the request or change its source branch. The operation changes review state, may require re-authentication or approval permission, and returns the updated approval result or a permission/state error.",
  unapprove_merge_request:
    "Use this to remove the current user's approval from an existing merge request; use `merge_merge_request` only when you intend to merge. The operation changes review state and requires approval permission, and GitLab returns the updated result or an error when the request or approval is unavailable.",
  rebase_merge_request:
    "Use this when the source branch is behind its target branch; use `get_merge_request_conflicts` to inspect conflicts and `merge_merge_request` to merge. The operation rewrites the source branch history with a force push and requires permission to push to that branch. With `wait` true (default), it polls until the rebase ends and returns the merge request plus `previous_sha` (its `sha` before the rebase) and `head_changed`. `head_changed: false` means that the head did not move; `merge_error` gives the reason when GitLab sends one. `merge_error` can keep a message from an earlier attempt, so it alone does not prove that this attempt failed. If the rebase still runs after `timeout_seconds`, it returns a timeout error while GitLab continues the rebase. With `wait` false, it returns GitLab's enqueue response (`rebase_in_progress` true) at once. Set `skip_ci` to skip the CI pipeline for the rebased branch.",
  get_merge_request_approval_state:
    "Use this to inspect approval rules and approvers before deciding whether a merge request can be merged; use `approve_merge_request` to change approval state. It is read-only and returns the approval-state response, while missing requests, unsupported GitLab versions, and permission failures are reported as errors.",
  get_merge_request_conflicts:
    "Use this to inspect merge conflicts before attempting `merge_merge_request`; it reports conflicts and does not resolve them. It is read-only, requires access to the project and merge request, and returns GitLab's conflict data or an error when the request cannot be evaluated.",
  list_merge_request_pipelines:
    "Use this to inspect pipelines associated with one merge request; use `list_pipelines` for project-wide pipeline filtering. It is read-only and paginated, requires project access, and returns pipeline records or GitLab errors for invalid identifiers, missing resources, or rate limits.",
  create_or_update_file:
    "Use this for a single repository file when you know whether the target path is new or already exists; use `push_files` for a multi-file commit. Optional `encoding` (`text` or `base64`) defaults to `GITLAB_REPO_FILE_ENCODING` so existing callers stay unchanged. The operation creates or updates remote content in a commit, requires repository write permission, and returns the commit result or a conflict/validation error.",
  push_files:
    "Use this to commit several file changes atomically; use `create_or_update_file` when only one path is involved. Each file defaults to action `create`; optional per-file `action` (create/update/delete/move) and `encoding` (text/base64) are additive. `GITLAB_PERMISSION_MODE=modify` rejects `delete` and `move`. The operation writes repository history on the selected branch, requires repository write permission, and returns the commit result or a validation, conflict, or protected-branch error.",
  create_issue:
    "Use this to open a new issue; use `update_issue` for an existing issue and `create_issue_note` to add discussion without changing issue fields. The operation creates remote project data, requires issue creation permission, and returns the new issue or a validation, permission, or duplicate-related error.",
  list_issues:
    "Use this for issue management: list GitLab issues, optionally scoped with `project_id`. Use `get_issue` when the issue iid is already known and `my_issues` for issues assigned to the current user. It is read-only and paginated, requires issue read permission, and returns issue records or GitLab errors for invalid identifiers, missing resources, or rate limits.",
  my_issues:
    "Use this for issue management: list issues assigned to the authenticated user. Use `list_issues` for project-wide or author-scoped listing and `get_issue` for one issue. Resolving the current user requires classic read_user or fine-grained User:Read. It is read-only and paginated, requires authentication, and returns assigned issue records or permission/rate-limit errors.",
  get_issue:
    "Use this for issue management: inspect one issue's fields; use `list_issues` or `my_issues` to discover issues first. It is read-only, requires issue read permission, and returns the issue or an error when the identifier is invalid, the issue is missing, or access is denied.",
  create_merge_request:
    "Use this to open a new merge request from an existing source branch to a target branch; use `update_merge_request` after it exists. The operation creates remote review state, requires project access, and returns the new merge request or a validation, permission, branch, or duplicate-related error.",
  fork_repository:
    "Use this to create a copy of an existing project in the current user's namespace or a permitted namespace; use `search_repositories` or `get_project` to inspect projects without copying them. The operation creates a new project, requires fork permission, and returns the forked project or a namespace/permission error.",
  create_branch:
    "Use this to create a branch from a branch, tag, or commit; use `get_branch` or `list_branches` to inspect branches and `protect_branch` to configure protection afterward. The operation changes remote repository state, requires branch-creation permission, and returns the new branch or a validation, missing-ref, protected-project, or already-exists error. `project_id` accepts a numeric ID or URL-encoded path, `branch` is the new name, and `ref` selects its starting revision.",
  delete_branch:
    "Use this only after confirming the branch name and intended data loss; use `get_branch` or `list_branches` before deletion and never use it to remove branch protection. The operation permanently removes a remote branch, requires branch-delete permission, and returns the deletion result or a protected-branch, missing-resource, or permission error.",
  protect_branch:
    "Use this to create a protection rule for a branch or wildcard that has none; it does not update an existing rule (GitLab returns 409 Conflict), so use `get_protected_branch` to check first and `update_protected_branch` to change a rule. The operation changes who may push, merge, or unprotect, may enable force-push or code-owner settings, requires maintainer-level permission, and returns the protection rule or a validation/permission/conflict error.",
  update_protected_branch:
    "Use this to change an existing protection rule for a branch or wildcard in place, so the branch is never left unprotected; use `protect_branch` to create a rule and `get_protected_branch` to read the access level record `id`s first. In `allowed_to_push`, `allowed_to_merge`, and `allowed_to_unprotect`, add an entry with one of `access_level`, `user_id`, `group_id`, or `deploy_key_id` (push only); change a record with its `id` and the new value; remove one with `{id, _destroy: true}`. `member_role_id` (custom roles) is not supported; an entry with only that key is rejected. For example, `allowed_to_push: [{id: 12, access_level: 0}]` sets that push record to No access. On Free, GitLab applies only `allow_force_push` and, from 18.10, `deploy_key_id` push entries; the other entries and `code_owner_approval_required` need Premium or Ultimate, so check the returned rule. A request whose `_destroy` entries would leave `allowed_to_unprotect` with no records is refused before the update; keep one or add a replacement in the same request. The operation changes repository security controls, requires maintainer-level permission, and returns the updated rule or a validation, missing-rule, or permission error.",
  unprotect_branch:
    "Use this to remove protection from an existing branch; use `update_protected_branch` to change access levels or force push while keeping the rule. The operation changes repository security controls, requires permission to manage protected branches, and returns the result or an error when the branch is missing or policy forbids the change.",
  protect_tag:
    "Use this to protect a tag or wildcard such as `v*` so protected CI/CD variables reach tag pipelines; use `get_protected_tag` or `list_protected_tags` to inspect existing rules first. The operation changes who may create matching tags, requires maintainer-level permission, and returns the protection rule or a validation/permission error.",
  unprotect_tag:
    "Use this to remove protection from an existing tag or wildcard. To change the create access level, use `unprotect_tag` first, then `protect_tag`; `protect_tag` creates a rule and does not update an existing rule. This change is unavailable in `modify` mode because `unprotect_tag` is blocked there. The operation changes repository security controls, requires permission to manage protected tags, and returns the result or an error when the tag is missing or policy forbids the change.",
  update_default_branch:
    "Use this to change which branch GitLab treats as the project's default; use `create_branch` to create a branch rather than changing project defaults. The operation changes project settings and may affect clone, merge request, and CI defaults, requires project-maintainer permission, and returns the updated project or a validation/permission error.",
  create_note:
    "Use this for a top-level comment on an issue or merge request when no typed discussion operation is needed; use `create_merge_request_thread` or `create_issue_note` for threaded replies. The operation creates remote discussion content, requires note permission, and returns the created note or a target/permission/validation error.",
  create_merge_request_thread:
    "Use this to start a review thread on a merge request; use `create_merge_request_note` for an unthreaded note and `create_merge_request_discussion_note` to reply to an existing thread. The operation creates remote review content, requires note permission, and returns the discussion or a position/permission/validation error.",
  resolve_merge_request_thread:
    "Use this to mark an existing merge request review thread resolved; use `update_merge_request_discussion_note` when the note text itself must change. The operation changes review state, requires permission to resolve discussions, and returns the updated discussion or a missing-thread/permission error.",
  mr_discussions:
    "Use this to list complete discussion threads for a merge request; use `get_merge_request_notes` when only flat notes are needed. It is read-only and returns threaded discussion items, while invalid merge request identifiers, missing resources, and permission failures are reported as errors.",
  get_merge_request_discussion:
    "Use this to fetch one known merge request discussion by discussion identifier; use `mr_discussions` for a collection and `get_merge_request_note` for a flat note. It is read-only and returns the discussion item or an error for an invalid identifier, missing discussion, or insufficient permission.",
  create_merge_request_discussion_note:
    "Use this to reply inside an existing merge request discussion; use `create_merge_request_thread` to start a new thread and `create_merge_request_note` for a top-level note. The operation creates remote review content, requires note permission, and returns the new note or a missing-discussion/position/permission error.",
  get_merge_request_note:
    "Use this to fetch one known merge request note by note identifier; use `get_merge_request_notes` for a collection and `mr_discussions` for threaded context. It is read-only and returns the note object or an error for an invalid identifier, missing note, or insufficient permission.",
  get_merge_request_notes:
    "Use this to list flat notes on a merge request; use `mr_discussions` when thread structure and resolution state are required. It is read-only and returns note records, while invalid identifiers, missing resources, and pagination or permission errors are reported by GitLab.",
  create_issue_note:
    "Use this to add a note to an existing issue, optionally as a reply to a discussion; use `update_issue` for issue fields and `create_note` only when the generic endpoint is required. The operation creates remote discussion content, requires note permission, and returns the note or a missing-issue/thread/permission error.",
  list_issue_discussions:
    "Use this to inspect threaded discussions for an issue; use `list_issues` for issue records and `get_issue` for one issue's fields. It is read-only and returns discussion items, while invalid identifiers, missing issues, and permission failures are reported as errors.",
  update_issue:
    "Use this to change fields on an existing issue; use `update_issue_description_patch` for a targeted description edit that avoids sending the full body, and use `create_issue_note` for discussion. The operation mutates issue state, requires issue-edit permission, and returns the updated issue or a validation/permission/conflict error.",
  update_issue_description_patch:
    "Use this for a targeted search/replace or unified-diff change to an issue description; use `dry_run` before applying an uncertain patch and `create_note` when an audit summary is wanted. It changes the issue description when not dry-running, requires issue-edit permission, and returns the patch result or a mismatch/validation/permission error.",
  delete_issue:
    "Use this only after confirming the issue and intended permanent removal; use `update_issue` to close or edit an issue without deleting it. The operation permanently removes issue data, requires delete permission, and returns the deletion result or a missing-resource, permission, or policy error.",
  delete_issue_link:
    "Use this to remove an existing relationship between two issues; use `list_issue_links` or `get_issue_link` to verify the link first. The operation changes issue relationships, requires issue-edit permission, and returns the result or an error when the link is missing or access is denied.",
  download_job_artifacts:
    "Use this to retrieve a pipeline job's artifact archive; remote HTTP mode returns a download URL while local mode saves the archive to a local path. It is read-only on GitLab but creates a local file in stdio mode (rejected in readonly mode), requires job/project access, and returns the download result or an artifact/permission error.",
  download_attachment:
    "Use this to retrieve a previously uploaded project attachment; remote mode returns inline base64 for images or a download URL, while local mode saves the file as a new file under the download directory (GITLAB_DOWNLOAD_DIR, default .gitlab-mcp-downloads). It is read-only with respect to GitLab but creates a local file in stdio mode (readonly mode returns images inline and rejects everything else), never replaces an existing file, requires project access, and returns the file content or an attachment/permission error.",
  gitlab_api_request:
    "Send one GitLab REST call under /api/v4. Readonly mode allows GET only, and modify mode rejects DELETE. Enable it only by listing api in GITLAB_TOOLSETS; all, discover_tools, and GITLAB_TOOLS do not. Prompt injection can drive this tool, so operators who rely on group, project, or tool restrictions must not enable it. GITLAB_ALLOWED_PROJECT_IDS is enforced only for /projects/:id paths; other endpoints are not constrained.",
  execute_graphql:
    "Use this only when a supported GitLab REST tool does not cover the requested operation; prefer a typed tool when one exists. The query is sent directly to GitLab and can include mutations when permission allows, so callers must treat it as potentially state-changing and handle GraphQL errors in the returned response.",
  discover_tools:
    "Use this when a needed opt-in category is not currently exposed; omit `category` to inspect available categories, then call it with a category to activate that group for the current session. It changes only the session's tool registry, returns the active-tool summary, and does not change GitLab data.",
  health_check:
    "Use this to verify server connectivity and authentication before making GitLab requests; use `whoami` when the authenticated user's identity is the goal. A 403 from GET /user with an insufficient_scope error means the token is accepted but User API scope is missing (read_user or fine-grained User:Read); the check stays ok, sets user_api_warning, and omits version metadata. Rate-limit and authentication-ban 403 responses stay unauthenticated. It does not mutate GitLab state and returns server/authentication status plus GitLab version details when available. Connection failures with no HTTP response return status error, authenticated false, and an error object (kind tls, dns, timeout, or network, plus code and message) instead of a protocol error.",
  whoami:
    "Use this to identify the authenticated GitLab user; use `get_user` or `get_users` when looking up another user. It requires classic read_user or fine-grained User:Read. It is read-only and returns the current user profile, while missing credentials or GitLab permission failures are reported as errors.",
  list_project_runners:
    "Use this when a job is stuck pending with no matching runner and you need the runners a project can use, including ancestor group runners and allowed instance runners. Filter with type, status, paused, and tag_list; the list payload includes id, description, runner_type, status, and paused (among other non-secret GitLab runner fields) but not tags — call `get_runner` for tag_list, run_untagged, locked, and access_level. It is read-only and paginated, requires Maintainer or Auditor access on the project, and never returns a runner registration token (runners_token) or runner authentication token.",
  get_runner:
    "Use this after list_project_runners when you already have a runner ID and need tag_list, run_untagged, locked, and access_level to explain a stuck pending job. Instance runner details are visible to authenticated users; group and project runners follow GitLab's role checks for that runner. When GITLAB_ALLOWED_PROJECT_IDS or a session project scope is active, the runner must appear on an allowed project's runner list before details are returned — pass project_id when more than one project is allowed — projects outside that allowlist are omitted, and groups are omitted because a project allowlist cannot verify them. GITLAB_PROJECT_ID alone is only the default project for that membership check when project_id is omitted. It does not omit other projects or groups. It is read-only and never returns a runner registration token (runners_token) or runner authentication token. token_expires_at is expiry metadata, not the token.",
  list_pipeline_schedules:
    "Use this to survey a project's scheduled pipelines and their `cron`, `next_run_at`, and `active` state, optionally narrowed with `scope` to `active` or `inactive`; use `list_pipelines` for pipelines that already ran and `get_pipeline_schedule` when the schedule ID is known. The list response carries no `variables` — call `get_pipeline_schedule` for those — and includes `inputs` only for Maintainers, Owners, or the schedule owner. It is read-only and paginated, requires project access, and returns schedule records or an error when the project is missing or access is denied.",
  get_pipeline_schedule:
    "Use this to inspect one schedule's cron, owner, last pipeline, variables, and inputs; use `list_pipeline_schedules` to discover schedule IDs and `list_pipeline_schedule_pipelines` for the pipelines it produced. It is read-only, returns `variables` and `inputs` only to Maintainers, Owners, or the schedule owner, and returns the schedule or an error when the schedule is missing or access is denied.",
  list_pipeline_schedule_pipelines:
    "Use this to review the pipelines a schedule has actually triggered, for example to see whether the nightly run succeeded; use `get_pipeline` for one pipeline's full detail and `list_pipelines` for project-wide filtering. Narrow the result with `scope`, `status`, `sort`, and the `created_*` / `updated_*` date bounds. It is read-only and paginated, requires project access, and returns pipeline records or an error when the schedule is missing or access is denied.",
  create_pipeline_schedule:
    "Use this to add a recurring pipeline for a branch or tag; use `create_pipeline` to run a pipeline once now and `update_pipeline_schedule` once the schedule exists. `ref` accepts a short name or a full ref such as `refs/heads/main`, which you should prefer when a branch and tag share a name; `cron_timezone` defaults to `UTC` and `active` defaults to true. It creates remote CI configuration, requires the Developer, Maintainer, or Owner role plus permission to run pipelines on the target ref, and returns the new schedule or a validation, cron, ref, or permission error.",
  update_pipeline_schedule:
    "Use this to change an existing schedule's cron, ref, description, inputs, or `active` flag; call `take_ownership_pipeline_schedule` first when the schedule belongs to another user, because GitLab rejects edits from non-owners. Every field is optional and GitLab reschedules the next run after the update. It changes remote CI configuration, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns the updated schedule or a validation, cron, or permission error.",
  delete_pipeline_schedule:
    "Use this only after confirming the schedule with `get_pipeline_schedule`; use `update_pipeline_schedule` with `active: false` to pause a schedule instead of removing it. The operation permanently removes the schedule and its variables, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns a confirmation or a missing-resource or permission error.",
  play_pipeline_schedule:
    "Use this to run a schedule's pipeline immediately without waiting for its cron; it does not shift `next_run_at`, so the regular cadence continues unchanged, and it does not modify the schedule itself. Use `create_pipeline` when you want a one-off pipeline that is unrelated to a schedule. It creates a pipeline on GitLab, requires ownership of the schedule and permission to run pipelines on its ref, is rate-limited to once per minute per schedule, and returns GitLab's acknowledgement message or a permission, rate-limit, or missing-schedule error.",
  take_ownership_pipeline_schedule:
    "Use this to transfer a schedule's ownership to the authenticated user, which is the prerequisite for `update_pipeline_schedule` or `delete_pipeline_schedule` on someone else's schedule; it does not otherwise change the cron, ref, or variables. It changes remote ownership, requires the Maintainer or Owner role, and returns the schedule with its new owner or a permission or missing-schedule error.",
  get_pipeline_schedule_variable:
    "Use this to read one variable attached to a pipeline schedule by key; use `get_pipeline_schedule` to list every variable at once and `get_project_variable` for project-level CI/CD variables, which are a separate set. It is read-only, requires the Maintainer or Owner role or ownership of the schedule (GitLab 18.7 or later exposes this endpoint), and returns the variable or an error when the schedule, key, or permission is missing.",
  create_pipeline_schedule_variable:
    "Use this to attach a new variable to a pipeline schedule so its scheduled pipelines receive it; use `update_pipeline_schedule_variable` when the key already exists and `create_project_variable` for a project-wide variable. `variable_type` defaults to `env_var` and `key` is limited to 255 characters matching /[a-zA-Z0-9_]+/. It creates remote CI configuration, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns the new variable or a validation, duplicate-key, or permission error.",
  update_pipeline_schedule_variable:
    "Use this to change the value or type of an existing pipeline schedule variable; use `create_pipeline_schedule_variable` when the key does not exist yet. It changes remote CI configuration that scheduled pipelines consume, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns the updated variable or a missing-key, validation, or permission error.",
  delete_pipeline_schedule_variable:
    "Use this only after confirming the key with `get_pipeline_schedule` or `get_pipeline_schedule_variable`; use `update_pipeline_schedule_variable` to change a value without removing it. The operation permanently removes the variable from the schedule so later scheduled pipelines no longer receive it, requires the Developer, Maintainer, or Owner role and ownership of the schedule, and returns a confirmation or a missing-key or permission error.",
  stop_stale_environments:
    "Use this to stop eligible stale environments in a project. GitLab excludes protected environments, and this operation stops environments without deleting them. It requires the necessary project permission and returns the result or a validation, permission, or rate-limit error.",
  delete_review_app_environments:
    "Use this to clean up stopped review-app environments after verifying the scope. GitLab schedules deletion one week later rather than deleting environments immediately; `dry_run` defaults to `true`, so actual scheduling requires `dry_run: false`. It requires the necessary project permission and returns the cleanup result or a validation, permission, or rate-limit error.",
  orbit_query:
    "Use this to answer cross-project relationship questions (blast radius, file-to-MR history, dependency fans) in one call instead of chaining list/get tools; use `orbit_get_schema` first when the node/edge types are unknown. It is read-only but each call consumes GitLab credits, requires Premium/Ultimate on an Orbit-enabled scope, and returns the graph result or a query/permission error.",
  orbit_get_schema:
    "Use this to learn the node and edge types available for `orbit_query` before writing a query; use `orbit_get_status` when the concern is index freshness rather than shape. It is read-only and free of credit charges, and returns the current graph schema or a permission error.",
  orbit_get_status:
    "Use this to check whether Orbit indexing has completed before trusting `orbit_query` results; results reflect the last index cycle, not real-time state. It is read-only and free of credit charges, and returns the indexing status or a permission error.",
  orbit_list_tools:
    "Use this to see which MCP tool definitions Orbit itself exposes; use `orbit_query` to run graph queries directly. It is read-only and free of credit charges, and returns the tool definition list or a permission error.",
};

const PARAMETER_GUIDANCE = "`project_id`/`group_id` take a numeric ID or URL-encoded path.";

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

function getBehaviorGuidance(readOnly: boolean, destructive: boolean): string {
  if (readOnly) {
    return "Read-only; missing resources, denied access, and rate limits return errors.";
  }
  if (destructive) {
    return "Changes or removes GitLab data and may be irreversible; needs permission.";
  }
  return "Changes GitLab data; needs permission and returns validation or conflict errors.";
}

export function getToolDescription(
  name: string,
  baseDescription: string,
  readOnly: boolean,
  destructive: boolean,
  acceptsProjectOrGroupId: boolean,
  toolNames: ReadonlySet<string>
): string {
  const explicitGuidance = TOOL_GUIDANCE[name];
  if (explicitGuidance) {
    return `${ensureSentence(baseDescription)} ${explicitGuidance}`;
  }

  const normalizedDescription = ensureSentence(baseDescription);
  if (normalizedDescription.length >= 180) {
    return normalizedDescription;
  }

  return [
    normalizedDescription,
    getLifecycleGuidance(name, toolNames),
    getBehaviorGuidance(readOnly, destructive),
    acceptsProjectOrGroupId ? PARAMETER_GUIDANCE : "",
  ]
    .filter(Boolean)
    .join(" ");
}
