const TOOL_GUIDANCE: Readonly<Record<string, string>> = {
  merge_merge_request:
    "Use this only after checking the merge request approval, conflict, and pipeline state; use `approve_merge_request` to approve rather than merge. The operation changes repository state and may squash commits, schedule auto-merge, or delete the source branch, so it requires merge permission and returns GitLab's merge result or a mergeability error. Pass `sha` from `get_merge_request` (`sha` or `diff_refs.head_sha`); GitLab 19.2+ groups may reject merges without it.",
  approve_merge_request:
    "Use this to record an approval on an existing merge request; it does not merge the request or change its source branch. The operation changes review state, may require re-authentication or approval permission, and returns the updated approval result or a permission/state error.",
  unapprove_merge_request:
    "Use this to remove the current user's approval from an existing merge request; use `merge_merge_request` only when you intend to merge. The operation changes review state and requires approval permission, and GitLab returns the updated result or an error when the request or approval is unavailable.",
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
  create_merge_request:
    "Use this to open a new merge request from an existing source branch to a target branch; use `update_merge_request` after it exists. The operation creates remote review state, requires project access, and returns the new merge request or a validation, permission, branch, or duplicate-related error.",
  fork_repository:
    "Use this to create a copy of an existing project in the current user's namespace or a permitted namespace; use `search_repositories` or `get_project` to inspect projects without copying them. The operation creates a new project, requires fork permission, and returns the forked project or a namespace/permission error.",
  create_branch:
    "Use this to create a branch from a branch, tag, or commit; use `get_branch` or `list_branches` to inspect branches and `protect_branch` to configure protection afterward. The operation changes remote repository state, requires branch-creation permission, and returns the new branch or a validation, missing-ref, protected-project, or already-exists error. `project_id` accepts a numeric ID or URL-encoded path, `branch` is the new name, and `ref` selects its starting revision.",
  delete_branch:
    "Use this only after confirming the branch name and intended data loss; use `get_branch` or `list_branches` before deletion and never use it to remove branch protection. The operation permanently removes a remote branch, requires branch-delete permission, and returns the deletion result or a protected-branch, missing-resource, or permission error.",
  protect_branch:
    "Use this to create or update protection rules for a branch or wildcard; use `get_protected_branch` to inspect existing rules first. The operation changes who may push, merge, or unprotect, may enable force-push or code-owner settings, requires maintainer-level permission, and returns the protection rule or a validation/permission error.",
  unprotect_branch:
    "Use this to remove protection from an existing branch; use `protect_branch` to change access levels without removing the rule. The operation changes repository security controls, requires permission to manage protected branches, and returns the result or an error when the branch is missing or policy forbids the change.",
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
    "Use this to retrieve a pipeline job's artifact archive; remote HTTP mode returns a download URL while local mode saves the archive to a local path. It is read-only but may create a local file in stdio mode, requires job/project access, and returns the download result or an artifact/permission error.",
  download_attachment:
    "Use this to retrieve a previously uploaded project attachment; remote mode returns inline base64 for images or a download URL, while local mode can save to a path. It is read-only with respect to GitLab, requires project access, and returns the file content or an attachment/permission error.",
  execute_graphql:
    "Use this only when a supported GitLab REST tool does not cover the requested operation; prefer a typed tool when one exists. The query is sent directly to GitLab and can include mutations when permission allows, so callers must treat it as potentially state-changing and handle GraphQL errors in the returned response.",
  discover_tools:
    "Use this when a needed opt-in category is not currently exposed; omit `category` to inspect available categories, then call it with a category to activate that group for the current session. It changes only the session's tool registry, returns the active-tool summary, and does not change GitLab data.",
  health_check:
    "Use this to verify server connectivity and authentication before making GitLab requests; use `whoami` when the authenticated user's identity is the goal. It does not mutate GitLab state and returns server/authentication status plus GitLab version details when available.",
  whoami:
    "Use this to identify the authenticated GitLab user; use `get_user` or `get_users` when looking up another user. It is read-only and returns the current user profile, while missing credentials or GitLab permission failures are reported as errors.",
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
};

const PARAMETER_GUIDANCE =
  "When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.";

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function getLifecycleGuidance(name: string): string {
  const verb = name.split("_")[0] ?? "use";

  if (verb === "list") {
    return "Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect.";
  }
  if (verb === "get") {
    return "Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources.";
  }
  if (verb === "create") {
    return "Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists.";
  }
  if (verb === "update" || verb === "edit") {
    return "Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text.";
  }
  if (verb === "delete" || verb === "remove") {
    return "Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it.";
  }
  if (verb === "search") {
    return "Use this to discover matching content; choose a typed get or list tool when the target identifier is already known.";
  }
  if (verb === "validate") {
    return "Use this to check configuration without applying it; choose a create or update tool only after validation succeeds.";
  }

  return "Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action.";
}

function getBehaviorGuidance(readOnly: boolean, destructive: boolean): string {
  if (readOnly) {
    return "It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors.";
  }
  if (destructive) {
    return "It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors.";
  }
  return "It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request.";
}

export function getToolDescription(
  name: string,
  baseDescription: string,
  readOnly: boolean,
  destructive: boolean
): string {
  const explicitGuidance = TOOL_GUIDANCE[name];
  if (explicitGuidance) {
    return `${ensureSentence(baseDescription)} ${explicitGuidance}`;
  }

  const normalizedDescription = ensureSentence(baseDescription);
  if (normalizedDescription.length >= 180) {
    return normalizedDescription;
  }

  return `${normalizedDescription} ${getLifecycleGuidance(name)} ${getBehaviorGuidance(readOnly, destructive)} ${PARAMETER_GUIDANCE}`;
}
