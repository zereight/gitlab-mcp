# Tools Reference

Complete catalog of every tool the GitLab MCP server exposes.

Which of these have an MCP `tools/call` test is tracked in
[Tool invocation coverage](../reference/tool-coverage.md).

> **Setup first** — if you haven't connected your Personal Access Token or
> OAuth credentials yet, follow one of the [client setup guides](../clients/claude-code.md)
> or read [Getting Started](../getting-started/index.md). Tools listed below
> will be unavailable until the server is authenticated.

## Feature toggles

Toolsets are split into a **default** set (exposed automatically) and an
**opt-in** set (must be explicitly enabled). The lists below are derived
directly from `TOOLSET_DEFINITIONS` in
[`tools/registry.ts`](https://github.com/zereight/gitlab-mcp/blob/main/tools/registry.ts).

| Status | Groups |
|---|---|
| **Default** — always exposed | [Core](core.md) |
| **Opt-in** — must be enabled | [Projects & Namespaces](projects.md), [Projects & Files](repositories.md), [Branches & Commits](branches.md), [Groups](groups.md), [Merge Requests](merge-requests.md), [Issues](issues.md), [Labels](labels.md), [Work Items](workitems.md), [CI Lint](ci.md), [Pipelines, Jobs & Deployments](pipelines.md) (legacy `USE_PIPELINE=true` is deprecated; removed in next major (v3.0.0)), [Milestones](milestones.md) (legacy `USE_MILESTONE=true` is deprecated; removed in next major (v3.0.0)), [Wiki](wiki.md) (legacy `USE_GITLAB_WIKI=true` is deprecated; removed in next major (v3.0.0)), [Releases](releases.md), [Tags](tags.md), [Users & Events](users.md), [Variables](variables.md), [Webhooks](webhooks.md), [Search](search.md), [Dependency Proxy](dependency-proxy.md), [Vulnerabilities](vulnerabilities.md), [GitLab Orbit](orbit.md), [Snippets](snippets.md) |
| **Explicit opt-in** — not included in `all` or `discover_tools` | [Raw API](api.md) |
| **Not a toolset** — `discover_tools` and `help` are always exposed; `execute_graphql` needs `GITLAB_TOOLS` | [Meta & GraphQL](meta.md) |

**How to enable opt-in groups** (any one is sufficient):

- `GITLAB_TOOLSETS=<group,…>` — comma-separated toolset IDs.
- `GITLAB_TOOLSETS=all` — enables every group except explicit-only toolsets (`api`).
- `GITLAB_TOOLSETS=merge_requests,issues,repositories,branches,projects,labels,ci,groups,users` — restores the pre-lean default set.
- `GITLAB_TOOLS=<tool,…>` — enables individual tools regardless of group, except explicit-only tools such as `gitlab_api_request`.
- `USE_PIPELINE`, `USE_MILESTONE`, and `USE_GITLAB_WIKI` are deprecated (removed in next major (v3.0.0)). Use `GITLAB_TOOLSETS=core,pipelines` and `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint`, `GITLAB_TOOLSETS=core,milestones`, or `GITLAB_TOOLSETS=core,wiki`. If you already set `GITLAB_TOOLSETS`, append the toolset to your existing list instead of replacing it. If `GITLAB_TOOLS` is already set, append `validate_ci_lint,validate_project_ci_lint` instead of replacing that list.
- Call the `discover_tools` MCP tool at runtime to activate categories for the current session.

Permission modes control which tools are exposed:

- `GITLAB_PERMISSION_MODE=readonly` — hides every write tool regardless of toggles. Mixed tools (`execute_graphql`, `gitlab_api_request`) stay listed; their handlers reject writes.
- `GITLAB_PERMISSION_MODE=modify` — allows create/update but blocks delete and teardown tools: every `delete_*` tool, `erase_pipeline_job`, `purge_dependency_proxy_cache`, the destructive teardown verbs `cancel_pipeline`, `cancel_pipeline_job`, `stop_environment`, `stop_stale_environments`, `unprotect_branch`, `unprotect_tag`, plus `push_files` `delete`/`move` actions.
- `GITLAB_READ_ONLY_MODE=true` is deprecated (removed in next major (v3.0.0)) — same as `readonly`; use `GITLAB_PERMISSION_MODE=readonly` instead.

The `modify` guard applies to typed tools (`tools/list` and `tools/call`) and to destructive mutations sent through `execute_graphql`: any top-level mutation field whose name contains a deletion verb (`delete`, `destroy`, `remove`, `prune`, `purge`, `erase`) or a teardown verb (`revoke`, `cancel`, `stop`, `terminate`, `unprotect`, `disable`, `deactivate`, `drop`, `unschedule`). See [Environment Variables](../configuration/environment-variables.md#gitlab_permission_mode).

See [Environment Variables](../configuration/environment-variables.md)
and [CLI Arguments](../getting-started/cli-arguments.md) for the full list.

## Legend

| Marker | Meaning |
|---|---|
| 📖 | **Read-only** — fetches data, does not modify GitLab state. Safe to invoke freely. |
| 📖✏️ | **Reads and writes** — can query or mutate. `execute_graphql` and `gitlab_api_request` stay available in readonly mode, which rejects their writes. `download_attachment` and `download_job_artifacts` only read GitLab but save files to the local disk in stdio mode; readonly mode lists them and rejects any call that would write a file. |
| ✏️ | **Writes** — creates, updates, or deletes data on GitLab. Confirm intent before running. |

## Browse by group

Each group has its own page with full parameter tables — click any tool name to jump to its details, or click the group title for the per-group view.

### [Core](core.md)

Lean default starter set for common MR, issue, repository, branch, project, label, and identity workflows. *(38 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_merge_requests`](core.md#list_merge_requests) | List merge requests (without project_id: user's MRs; with project_id: project MRs). For one known resource, use the matching get tool. | 📖 |
| [`get_merge_request`](core.md#get_merge_request) | Get details of a merge request (merge_request_iid or source_branch required). Set include_summaries=true for deployment/commit/approval summaries. To find resources, use the matching list or search tool. | 📖 |
| [`get_merge_request_approval_state`](core.md#get_merge_request_approval_state) | Get merge request approval details including approvers. Inspect approval rules and approvers before merging. Use `approve_merge_request` to change approval state. | 📖 |
| [`list_merge_request_changed_files`](core.md#list_merge_request_changed_files) | List changed file paths in a merge request without diff content (merge_request_iid or source_branch required). | 📖 |
| [`get_merge_request_file_diff`](core.md#get_merge_request_file_diff) | Get diffs for specific files from a merge request (merge_request_iid or source_branch required). | 📖 |
| [`list_merge_request_diffs`](core.md#list_merge_request_diffs) | List merge request diffs with pagination (merge_request_iid or source_branch required). For one known resource, use the matching get tool. | 📖 |
| [`get_merge_request_diffs`](core.md#get_merge_request_diffs) | Get the changes/diffs of a merge request (merge_request_iid or source_branch required). To find resources, use the matching list or search tool. | 📖 |
| [`mr_discussions`](core.md#mr_discussions) | List discussion items for a merge request. List complete discussion threads. Use `get_merge_request_notes` for flat notes. | 📖 |
| [`get_merge_request_discussion`](core.md#get_merge_request_discussion) | Get a single discussion item for a merge request. Fetch one discussion by id. Use `mr_discussions` for a collection and `get_merge_request_note` for a flat note. | 📖 |
| [`get_merge_request_note`](core.md#get_merge_request_note) | Get a specific note for a merge request. Fetch one note by id. Use `get_merge_request_notes` for a collection and `mr_discussions` for threads. | 📖 |
| [`get_merge_request_notes`](core.md#get_merge_request_notes) | List notes for a merge request. List flat notes. Use `mr_discussions` when thread structure and resolution state are required. | 📖 |
| [`create_merge_request`](core.md#create_merge_request) | Create a new merge request. Open a merge request from an existing source branch to a target. Use `update_merge_request` after it exists. | ✏️ |
| [`create_merge_request_thread`](core.md#create_merge_request_thread) | Create a new thread on a merge request. Start a review thread. Use `create_merge_request_note` for an unthreaded note and `create_merge_request_discussion_note` to reply. | ✏️ |
| [`resolve_merge_request_thread`](core.md#resolve_merge_request_thread) | Resolve a thread on a merge request. Mark an existing review thread resolved. Use `update_merge_request_discussion_note` to change note text. | ✏️ |
| [`update_merge_request`](core.md#update_merge_request) | Update a merge request (merge_request_iid or source_branch required). Use the create tool for new resources and a note tool for comments. | ✏️ |
| [`list_issues`](core.md#list_issues) | List issues (default: created by current user; use scope='all' for all). Use this for issue management: list GitLab issues, optionally scoped with `project_id`. Use `get_issue` when the iid is known and `my_issues` for the current user's assignments. | 📖 |
| [`my_issues`](core.md#my_issues) | List issues assigned to the authenticated user. Use this for issue management: list issues assigned to the authenticated user. Use `list_issues` for project-wide listing and `get_issue` for one issue. Requires classic read_user or fine-grained User:Read. | 📖 |
| [`get_issue`](core.md#get_issue) | Get details of a specific issue. Returns the issue with a slim nested milestone by default; set full_response=true for the complete milestone object. Use this for issue management: inspect one issue. Use `list_issues` or `my_issues` to discover issues first. | 📖 |
| [`create_issue`](core.md#create_issue) | Create a new issue. Open a new issue. Use `update_issue` for an existing issue and `create_issue_note` for discussion. | ✏️ |
| [`update_issue`](core.md#update_issue) | Update an issue. Returns a slim confirmation by default; set full_response=true for the complete updated issue object. Change fields on an existing issue. Use `update_issue_description_patch` for a targeted description edit and `create_issue_note` for discussion. | ✏️ |
| [`create_issue_note`](core.md#create_issue_note) | Add a note to an issue, optionally replying to a discussion thread. Add a note to an existing issue, optionally as a reply. Use `update_issue` for issue fields. | ✏️ |
| [`list_issue_discussions`](core.md#list_issue_discussions) | List discussions for an issue. List threaded discussions for an issue. Use `list_issues` or `get_issue` for issue records. | 📖 |
| [`update_issue_description_patch`](core.md#update_issue_description_patch) | Apply a patch (search/replace or unified diff) to an issue description. Reduces token usage by allowing small changes without sending the full description. Supports dry_run to preview changes and create_note to summarize updates. | ✏️ |
| [`get_file_contents`](core.md#get_file_contents) | Get contents of a file or directory from a GitLab project. | 📖 |
| [`get_repository_tree`](core.md#get_repository_tree) | List files and directories in a repository. | 📖 |
| [`search_repositories`](core.md#search_repositories) | Search for GitLab projects. If the identifier is known, use a typed get or list tool. | 📖 |
| [`get_branch`](core.md#get_branch) | Get branch details (commit, protection status). To find resources, use the matching list or search tool. | 📖 |
| [`list_branches`](core.md#list_branches) | List branches in project with search filter. For one known resource, use the matching get tool. | 📖 |
| [`list_commits`](core.md#list_commits) | List repository commits with filtering options. For one known resource, use the matching get tool. | 📖 |
| [`get_commit`](core.md#get_commit) | Get details of a specific commit. To find resources, use the matching list or search tool. | 📖 |
| [`get_commit_diff`](core.md#get_commit_diff) | Get changes/diffs of a specific commit. Return the file diffs for one commit. Use `get_commit` for metadata without the patch. | 📖 |
| [`get_file_blame`](core.md#get_file_blame) | Get git blame for a file at a given ref. Each entry maps a contiguous range of source lines to the commit that last changed them (id, author, authored_date, message). Use range_start/range_end to limit blame to specific lines. | 📖 |
| [`get_project`](core.md#get_project) | Get details of a specific project. To find resources, use the matching list or search tool. | 📖 |
| [`list_projects`](core.md#list_projects) | List projects accessible by the current user. For one known resource, use the matching get tool. | 📖 |
| [`list_project_members`](core.md#list_project_members) | List members of a GitLab project. Search project members by name or username. Use `list_group_members` for a group. | 📖 |
| [`list_labels`](core.md#list_labels) | List labels for a project. For one known resource, use the matching get tool. | 📖 |
| [`whoami`](core.md#whoami) | Get current authenticated user details. Requires classic read_user or fine-grained User:Read. Use `get_user` or `get_users` to look up another user. | 📖 |
| [`health_check`](core.md#health_check) | Verify server status and authentication. Always reports the MCP server version (mcp_server_version). When authenticated, also reports the GitLab instance version from GET /api/v4/version (version, revision, enterprise). Version lookup failures do not fail the health check — those fields are omitted. | 📖 |

### [Projects & Namespaces](projects.md)

Project/namespace listing, member queries, group iterations, and server health. *(11 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=projects` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 4 of these tools (`get_project`, `list_projects`, `list_project_members`, `health_check`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_project`](projects.md#get_project) | Get details of a specific project. To find resources, use the matching list or search tool. | 📖 |
| [`list_projects`](projects.md#list_projects) | List projects accessible by the current user. For one known resource, use the matching get tool. | 📖 |
| [`update_project`](projects.md#update_project) | Update project settings such as description, visibility, default branch, and feature access levels. | ✏️ |
| [`list_project_members`](projects.md#list_project_members) | List members of a GitLab project. Search project members by name or username. Use `list_group_members` for a group. | 📖 |
| [`list_group_members`](projects.md#list_group_members) | List members of a GitLab group with optional name or username search. | 📖 |
| [`list_namespaces`](projects.md#list_namespaces) | List all namespaces (users and groups) available to the current user. Filter by kind='group' for groups only. For one known resource, use the matching get tool. | 📖 |
| [`get_namespace`](projects.md#get_namespace) | Get details of a namespace (user or group) by ID or path. Groups are namespaces with kind='group'. To find resources, use the matching list or search tool. | 📖 |
| [`verify_namespace`](projects.md#verify_namespace) | Verify if a namespace path exists. Use parent_id to scope the check to a specific parent namespace — required for nested namespaces where the same path may exist under different parents. | 📖 |
| [`list_group_projects`](projects.md#list_group_projects) | List projects in a group. | 📖 |
| [`list_group_iterations`](projects.md#list_group_iterations) | List group iterations with filtering options. | 📖 |
| [`health_check`](projects.md#health_check) | Verify server status and authentication. Always reports the MCP server version (mcp_server_version). When authenticated, also reports the GitLab instance version from GET /api/v4/version (version, revision, enterprise). Version lookup failures do not fail the health check — those fields are omitted. | 📖 |

### [Projects & Files](repositories.md)

Project search/creation/fork plus the Files API for reading and writing repository content without shelling out to git. *(7 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=repositories` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 3 of these tools (`search_repositories`, `get_file_contents`, `get_repository_tree`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`search_repositories`](repositories.md#search_repositories) | Search for GitLab projects. If the identifier is known, use a typed get or list tool. | 📖 |
| [`create_repository`](repositories.md#create_repository) | Create a new GitLab project. | ✏️ |
| [`get_file_contents`](repositories.md#get_file_contents) | Get contents of a file or directory from a GitLab project. | 📖 |
| [`push_files`](repositories.md#push_files) | Push multiple files in a single commit. Commit several file changes atomically. Each file defaults to action `create`; optional per-file `action` (create/update/delete/move) and `encoding` (text/base64) are additive. `GITLAB_PERMISSION_MODE=modify` rejects `delete` and `move`. | ✏️ |
| [`create_or_update_file`](repositories.md#create_or_update_file) | Create or update a file in a GitLab project. Create or update one repository file. Use `push_files` for a multi-file commit. Optional `encoding` (`text` or `base64`) defaults to `GITLAB_REPO_FILE_ENCODING`. | ✏️ |
| [`fork_repository`](repositories.md#fork_repository) | Fork a project to your account or specified namespace. Fork an existing project into the current user's namespace or a permitted namespace. Use `search_repositories` or `get_project` to inspect without copying. | ✏️ |
| [`get_repository_tree`](repositories.md#get_repository_tree) | List files and directories in a repository. | 📖 |

### [Branches & Commits](branches.md)

Branch management, commit listing/inspection, file blame, and CI commit-status manipulation. *(16 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=branches` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 6 of these tools (`get_branch`, `list_branches`, `list_commits`, `get_commit`, `get_commit_diff`, `get_file_blame`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`create_branch`](branches.md#create_branch) | Create a new branch. Create a branch from a source branch, tag, or commit. Use `protect_branch` after creation. Returns already-exists when the name is taken. | ✏️ |
| [`get_branch`](branches.md#get_branch) | Get branch details (commit, protection status). To find resources, use the matching list or search tool. | 📖 |
| [`list_branches`](branches.md#list_branches) | List branches in project with search filter. For one known resource, use the matching get tool. | 📖 |
| [`delete_branch`](branches.md#delete_branch) | Delete branch from project. Permanently delete a remote branch. Confirm the name first with `get_branch` or `list_branches`; this does not remove branch protection. | ✏️ |
| [`list_protected_branches`](branches.md#list_protected_branches) | List protected branches in a project, supports search filter. For one known resource, use the matching get tool. | 📖 |
| [`get_protected_branch`](branches.md#get_protected_branch) | Get details of a single protected branch (access levels, force push settings). To find resources, use the matching list or search tool. | 📖 |
| [`protect_branch`](branches.md#protect_branch) | Protect a repository branch (set push/merge/unprotect access levels). Create a protection rule; GitLab returns 409 if one exists. Use `update_protected_branch` to change an existing rule. | ✏️ |
| [`update_protected_branch`](branches.md#update_protected_branch) | Update an existing protected branch rule in place (access levels, force push, code owner approval). Change an existing protection rule in place (do not unprotect first). Read record `id`s with `get_protected_branch`. In `allowed_to_push`, `allowed_to_merge`, and `allowed_to_unprotect`, add with `access_level`, `user_id`, `group_id`, or `deploy_key_id` (push only); change with `id`; remove with `{id, _destroy: true}`. `member_role_id` is not supported. A request that would leave `allowed_to_unprotect` empty is refused. GitLab may reject the update unless the caller is on the current unprotect list. | ✏️ |
| [`unprotect_branch`](branches.md#unprotect_branch) | Remove protection from a previously protected branch. Remove protection. Use `update_protected_branch` to change access levels without removing the rule. | ✏️ |
| [`update_default_branch`](branches.md#update_default_branch) | Change the default branch of a project. Change the project's default branch. Use `create_branch` to create a branch rather than changing defaults. | ✏️ |
| [`list_commits`](branches.md#list_commits) | List repository commits with filtering options. For one known resource, use the matching get tool. | 📖 |
| [`get_commit`](branches.md#get_commit) | Get details of a specific commit. To find resources, use the matching list or search tool. | 📖 |
| [`get_commit_diff`](branches.md#get_commit_diff) | Get changes/diffs of a specific commit. Return the file diffs for one commit. Use `get_commit` for metadata without the patch. | 📖 |
| [`get_file_blame`](branches.md#get_file_blame) | Get git blame for a file at a given ref. Each entry maps a contiguous range of source lines to the commit that last changed them (id, author, authored_date, message). Use range_start/range_end to limit blame to specific lines. | 📖 |
| [`list_commit_statuses`](branches.md#list_commit_statuses) | List statuses for a commit. | 📖 |
| [`create_commit_status`](branches.md#create_commit_status) | Create or update the status of a commit. | ✏️ |

### [Groups](groups.md)

Create new groups and subgroups. *(1 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=groups` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`create_group`](groups.md#create_group) | Create new group or subgroup. | ✏️ |

### [Merge Requests](merge-requests.md)

MR lifecycle — create, update, merge, approve, plus diff/conflict inspection and the full discussion/note/draft API. *(46 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=merge_requests` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 17 of these tools (`get_merge_request_approval_state`, `get_branch`, `list_branches`, `get_merge_request`, `get_merge_request_diffs`, `list_merge_request_changed_files`, `list_merge_request_diffs`, `get_merge_request_file_diff`, `update_merge_request`, `create_merge_request`, `list_merge_requests`, `mr_discussions`, `get_merge_request_discussion`, `get_merge_request_note`, `get_merge_request_notes`, `create_merge_request_thread`, `resolve_merge_request_thread`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`merge_merge_request`](merge-requests.md#merge_merge_request) | Merge a merge request. Use this only after checking approval, conflicts, and pipeline state; use `approve_merge_request` to approve rather than merge. Pass `sha` from `get_merge_request`; GitLab 19.2+ groups may reject merges without it. | ✏️ |
| [`rebase_merge_request`](merge-requests.md#rebase_merge_request) | Rebase the source branch of a merge request onto its target branch. Rebase the source onto the target (force-push). With `wait` true (default) it returns `previous_sha` and `head_changed`; `merge_error` can be stale. Use `get_merge_request_conflicts` for conflicts. | ✏️ |
| [`approve_merge_request`](merge-requests.md#approve_merge_request) | Approve a merge request. Record an approval on an existing merge request. It does not merge or change the source branch. | ✏️ |
| [`unapprove_merge_request`](merge-requests.md#unapprove_merge_request) | Unapprove a merge request. Remove the current user's approval. Use `merge_merge_request` only when you intend to merge. | ✏️ |
| [`get_merge_request_approval_state`](merge-requests.md#get_merge_request_approval_state) | Get merge request approval details including approvers. Inspect approval rules and approvers before merging. Use `approve_merge_request` to change approval state. | 📖 |
| [`get_branch`](merge-requests.md#get_branch) | Get branch details (commit, protection status). To find resources, use the matching list or search tool. | 📖 |
| [`list_branches`](merge-requests.md#list_branches) | List branches in project with search filter. For one known resource, use the matching get tool. | 📖 |
| [`get_merge_request_conflicts`](merge-requests.md#get_merge_request_conflicts) | Get the conflicts of a merge request. Inspect merge conflicts before `merge_merge_request`. It reports conflicts and does not resolve them. | 📖 |
| [`list_merge_request_pipelines`](merge-requests.md#list_merge_request_pipelines) | List pipelines for a merge request with pagination. List pipelines for one merge request. Use `list_pipelines` for project-wide filtering. | 📖 |
| [`get_merge_request`](merge-requests.md#get_merge_request) | Get details of a merge request (merge_request_iid or source_branch required). Set include_summaries=true for deployment/commit/approval summaries. To find resources, use the matching list or search tool. | 📖 |
| [`get_merge_request_diffs`](merge-requests.md#get_merge_request_diffs) | Get the changes/diffs of a merge request (merge_request_iid or source_branch required). To find resources, use the matching list or search tool. | 📖 |
| [`list_merge_request_changed_files`](merge-requests.md#list_merge_request_changed_files) | List changed file paths in a merge request without diff content (merge_request_iid or source_branch required). | 📖 |
| [`list_merge_request_diffs`](merge-requests.md#list_merge_request_diffs) | List merge request diffs with pagination (merge_request_iid or source_branch required). For one known resource, use the matching get tool. | 📖 |
| [`get_merge_request_file_diff`](merge-requests.md#get_merge_request_file_diff) | Get diffs for specific files from a merge request (merge_request_iid or source_branch required). | 📖 |
| [`list_merge_request_versions`](merge-requests.md#list_merge_request_versions) | List all versions of a merge request. For one known resource, use the matching get tool. | 📖 |
| [`get_merge_request_version`](merge-requests.md#get_merge_request_version) | Get a specific version of a merge request. To find resources, use the matching list or search tool. | 📖 |
| [`update_merge_request`](merge-requests.md#update_merge_request) | Update a merge request (merge_request_iid or source_branch required). Use the create tool for new resources and a note tool for comments. | ✏️ |
| [`create_merge_request`](merge-requests.md#create_merge_request) | Create a new merge request. Open a merge request from an existing source branch to a target. Use `update_merge_request` after it exists. | ✏️ |
| [`list_merge_requests`](merge-requests.md#list_merge_requests) | List merge requests (without project_id: user's MRs; with project_id: project MRs). For one known resource, use the matching get tool. | 📖 |
| [`list_group_merge_requests`](merge-requests.md#list_group_merge_requests) | List merge requests across all projects of a group and its subgroups. | 📖 |
| [`get_branch_diffs`](merge-requests.md#get_branch_diffs) | Get diffs between two branches or commits. | 📖 |
| [`mr_discussions`](merge-requests.md#mr_discussions) | List discussion items for a merge request. List complete discussion threads. Use `get_merge_request_notes` for flat notes. | 📖 |
| [`get_merge_request_discussion`](merge-requests.md#get_merge_request_discussion) | Get a single discussion item for a merge request. Fetch one discussion by id. Use `mr_discussions` for a collection and `get_merge_request_note` for a flat note. | 📖 |
| [`create_merge_request_note`](merge-requests.md#create_merge_request_note) | Add a new note to a merge request. If the resource already exists, use the update tool. | ✏️ |
| [`update_merge_request_note`](merge-requests.md#update_merge_request_note) | Modify an existing merge request note. Use the create tool for new resources. | ✏️ |
| [`delete_merge_request_note`](merge-requests.md#delete_merge_request_note) | Delete an existing merge request note. Verify the target first with a get or list tool. | ✏️ |
| [`get_merge_request_note`](merge-requests.md#get_merge_request_note) | Get a specific note for a merge request. Fetch one note by id. Use `get_merge_request_notes` for a collection and `mr_discussions` for threads. | 📖 |
| [`get_merge_request_notes`](merge-requests.md#get_merge_request_notes) | List notes for a merge request. List flat notes. Use `mr_discussions` when thread structure and resolution state are required. | 📖 |
| [`delete_merge_request_discussion_note`](merge-requests.md#delete_merge_request_discussion_note) | Delete a discussion note on a merge request. Verify the target first with a get or list tool. | ✏️ |
| [`update_merge_request_discussion_note`](merge-requests.md#update_merge_request_discussion_note) | Update a discussion note on a merge request. Use the create tool for new resources. | ✏️ |
| [`create_merge_request_discussion_note`](merge-requests.md#create_merge_request_discussion_note) | Add a new discussion note to an existing merge request thread. Reply inside an existing discussion. Use `create_merge_request_thread` to start a thread and `create_merge_request_note` for a top-level note. | ✏️ |
| [`get_draft_note`](merge-requests.md#get_draft_note) | Get a single draft note from a merge request. To find resources, use the matching list or search tool. | 📖 |
| [`list_draft_notes`](merge-requests.md#list_draft_notes) | List draft notes for a merge request. For one known resource, use the matching get tool. | 📖 |
| [`create_draft_note`](merge-requests.md#create_draft_note) | Create a draft note for a merge request. If the resource already exists, use the update tool. | ✏️ |
| [`update_draft_note`](merge-requests.md#update_draft_note) | Update an existing draft note. Use the create tool for new resources. | ✏️ |
| [`delete_draft_note`](merge-requests.md#delete_draft_note) | Delete a draft note. Verify the target first with a get or list tool. | ✏️ |
| [`publish_draft_note`](merge-requests.md#publish_draft_note) | Publish a single draft note. | ✏️ |
| [`bulk_publish_draft_notes`](merge-requests.md#bulk_publish_draft_notes) | Publish all draft notes for a merge request. Optionally sets reviewer_state and posts a summary note (GitLab 19.2+). Can set reviewer_state even with no drafts. | ✏️ |
| [`create_merge_request_thread`](merge-requests.md#create_merge_request_thread) | Create a new thread on a merge request. Start a review thread. Use `create_merge_request_note` for an unthreaded note and `create_merge_request_discussion_note` to reply. | ✏️ |
| [`resolve_merge_request_thread`](merge-requests.md#resolve_merge_request_thread) | Resolve a thread on a merge request. Mark an existing review thread resolved. Use `update_merge_request_discussion_note` to change note text. | ✏️ |
| [`list_merge_request_emoji_reactions`](merge-requests.md#list_merge_request_emoji_reactions) | List all emoji reactions on a merge request. | 📖 |
| [`list_merge_request_note_emoji_reactions`](merge-requests.md#list_merge_request_note_emoji_reactions) | List all emoji reactions on a merge request note. Pass discussion_id for discussion thread replies. | 📖 |
| [`create_merge_request_emoji_reaction`](merge-requests.md#create_merge_request_emoji_reaction) | Add an emoji reaction to a merge request (e.g. thumbsup, rocket, eyes). | ✏️ |
| [`delete_merge_request_emoji_reaction`](merge-requests.md#delete_merge_request_emoji_reaction) | Remove an emoji reaction from a merge request. Verify the target first with a get or list tool. | ✏️ |
| [`create_merge_request_note_emoji_reaction`](merge-requests.md#create_merge_request_note_emoji_reaction) | Add an emoji reaction to a merge request note. Pass discussion_id for discussion thread replies. | ✏️ |
| [`delete_merge_request_note_emoji_reaction`](merge-requests.md#delete_merge_request_note_emoji_reaction) | Remove an emoji reaction from a merge request note. Pass discussion_id for discussion thread replies. Verify the target first with a get or list tool. | ✏️ |

### [Issues](issues.md)

Issue CRUD, links, discussions and notes, todos, and emoji reactions. *(24 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=issues` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 8 of these tools (`create_issue`, `list_issues`, `my_issues`, `get_issue`, `update_issue`, `update_issue_description_patch`, `create_issue_note`, `list_issue_discussions`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`create_issue`](issues.md#create_issue) | Create a new issue. Open a new issue. Use `update_issue` for an existing issue and `create_issue_note` for discussion. | ✏️ |
| [`list_issues`](issues.md#list_issues) | List issues (default: created by current user; use scope='all' for all). Use this for issue management: list GitLab issues, optionally scoped with `project_id`. Use `get_issue` when the iid is known and `my_issues` for the current user's assignments. | 📖 |
| [`my_issues`](issues.md#my_issues) | List issues assigned to the authenticated user. Use this for issue management: list issues assigned to the authenticated user. Use `list_issues` for project-wide listing and `get_issue` for one issue. Requires classic read_user or fine-grained User:Read. | 📖 |
| [`get_issue`](issues.md#get_issue) | Get details of a specific issue. Returns the issue with a slim nested milestone by default; set full_response=true for the complete milestone object. Use this for issue management: inspect one issue. Use `list_issues` or `my_issues` to discover issues first. | 📖 |
| [`update_issue`](issues.md#update_issue) | Update an issue. Returns a slim confirmation by default; set full_response=true for the complete updated issue object. Change fields on an existing issue. Use `update_issue_description_patch` for a targeted description edit and `create_issue_note` for discussion. | ✏️ |
| [`update_issue_description_patch`](issues.md#update_issue_description_patch) | Apply a patch (search/replace or unified diff) to an issue description. Reduces token usage by allowing small changes without sending the full description. Supports dry_run to preview changes and create_note to summarize updates. | ✏️ |
| [`delete_issue`](issues.md#delete_issue) | Delete an issue. Permanently delete an issue. Use `update_issue` to close or edit without deleting. | ✏️ |
| [`list_todos`](issues.md#list_todos) | List GitLab to-do items for the current user. | 📖 |
| [`mark_todo_done`](issues.md#mark_todo_done) | Mark a GitLab to-do item as done. | ✏️ |
| [`mark_all_todos_done`](issues.md#mark_all_todos_done) | Mark all pending GitLab to-do items as done for the current user. | ✏️ |
| [`create_issue_note`](issues.md#create_issue_note) | Add a note to an issue, optionally replying to a discussion thread. Add a note to an existing issue, optionally as a reply. Use `update_issue` for issue fields. | ✏️ |
| [`update_issue_note`](issues.md#update_issue_note) | Modify an existing issue thread note. Use the create tool for new resources. | ✏️ |
| [`list_issue_links`](issues.md#list_issue_links) | List all issue links for a specific issue. For one known resource, use the matching get tool. | 📖 |
| [`list_issue_discussions`](issues.md#list_issue_discussions) | List discussions for an issue. List threaded discussions for an issue. Use `list_issues` or `get_issue` for issue records. | 📖 |
| [`get_issue_link`](issues.md#get_issue_link) | Get a specific issue link. To find resources, use the matching list or search tool. | 📖 |
| [`create_issue_link`](issues.md#create_issue_link) | Create an issue link between two issues. | ✏️ |
| [`delete_issue_link`](issues.md#delete_issue_link) | Delete an issue link. Remove a relationship between two issues. Verify first with `list_issue_links` or `get_issue_link`. | ✏️ |
| [`create_note`](issues.md#create_note) | Create a new note (comment) to an issue or merge request. Add a top-level comment on an issue or merge request. Use `create_merge_request_thread` or `create_issue_note` for typed discussion. | ✏️ |
| [`list_issue_emoji_reactions`](issues.md#list_issue_emoji_reactions) | List all emoji reactions on an issue. | 📖 |
| [`list_issue_note_emoji_reactions`](issues.md#list_issue_note_emoji_reactions) | List all emoji reactions on an issue note. Pass discussion_id for discussion thread replies. | 📖 |
| [`create_issue_emoji_reaction`](issues.md#create_issue_emoji_reaction) | Add an emoji reaction to an issue (e.g. thumbsup, rocket, eyes). | ✏️ |
| [`delete_issue_emoji_reaction`](issues.md#delete_issue_emoji_reaction) | Remove an emoji reaction from an issue. Verify the target first with a get or list tool. | ✏️ |
| [`create_issue_note_emoji_reaction`](issues.md#create_issue_note_emoji_reaction) | Add an emoji reaction to an issue note. Pass discussion_id for discussion thread replies. | ✏️ |
| [`delete_issue_note_emoji_reaction`](issues.md#delete_issue_note_emoji_reaction) | Remove an emoji reaction from an issue note. Pass discussion_id for discussion thread replies. Verify the target first with a get or list tool. | ✏️ |

### [Labels](labels.md)

Project label CRUD. *(5 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=labels` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 1 of these tools (`list_labels`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_labels`](labels.md#list_labels) | List labels for a project. For one known resource, use the matching get tool. | 📖 |
| [`get_label`](labels.md#get_label) | Get a single label from a project. To find resources, use the matching list or search tool. | 📖 |
| [`create_label`](labels.md#create_label) | Create a new label in a project. If the resource already exists, use the update tool. | ✏️ |
| [`update_label`](labels.md#update_label) | Update an existing label in a project. Use the create tool for new resources. | ✏️ |
| [`delete_label`](labels.md#delete_label) | Delete a label from a project. Verify the target first with a get or list tool. | ✏️ |

### [Work Items](workitems.md)

Modern unified API for issues, tasks, incidents, and other typed work items — including notes, emoji reactions, and incident timeline events. *(18 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=workitems` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_work_item`](workitems.md#get_work_item) | Get a work item with full details including status, hierarchy, type, and widgets. To find resources, use the matching list or search tool. | 📖 |
| [`list_work_items`](workitems.md#list_work_items) | List work items with filters (type, state, search, assignees, labels). For one known resource, use the matching get tool. | 📖 |
| [`create_work_item`](workitems.md#create_work_item) | Create a work item (issue, task, incident, epic, etc.) with full field support. If the resource already exists, use the update tool. | ✏️ |
| [`update_work_item`](workitems.md#update_work_item) | Update a work item (title, description, labels, assignees, state, parent, custom fields, etc.). Use the create tool for new resources and a note tool for comments. | ✏️ |
| [`convert_work_item_type`](workitems.md#convert_work_item_type) | Convert a work item to a different type. | ✏️ |
| [`list_work_item_statuses`](workitems.md#list_work_item_statuses) | List available statuses for a work item type (Premium/Ultimate). | 📖 |
| [`list_custom_field_definitions`](workitems.md#list_custom_field_definitions) | List custom field definitions for a work item type. | 📖 |
| [`move_work_item`](workitems.md#move_work_item) | Move a work item to a different project. | ✏️ |
| [`list_work_item_notes`](workitems.md#list_work_item_notes) | List notes and discussions on a work item. | 📖 |
| [`create_work_item_note`](workitems.md#create_work_item_note) | Add a note to a work item (supports Markdown, internal notes, threads). | ✏️ |
| [`list_work_item_emoji_reactions`](workitems.md#list_work_item_emoji_reactions) | List all emoji reactions on a work item. | 📖 |
| [`list_work_item_note_emoji_reactions`](workitems.md#list_work_item_note_emoji_reactions) | List all emoji reactions on a work item note (comment, thread, or thread reply). | 📖 |
| [`create_work_item_emoji_reaction`](workitems.md#create_work_item_emoji_reaction) | Add an emoji reaction to a work item (e.g. thumbsup, rocket, eyes). | ✏️ |
| [`delete_work_item_emoji_reaction`](workitems.md#delete_work_item_emoji_reaction) | Remove an emoji reaction from a work item. Verify the target first with a get or list tool. | ✏️ |
| [`create_work_item_note_emoji_reaction`](workitems.md#create_work_item_note_emoji_reaction) | Add an emoji reaction to a work item note (comment, thread, or thread reply). | ✏️ |
| [`delete_work_item_note_emoji_reaction`](workitems.md#delete_work_item_note_emoji_reaction) | Remove an emoji reaction from a work item note (comment, thread, or thread reply). Verify the target first with a get or list tool. | ✏️ |
| [`get_timeline_events`](workitems.md#get_timeline_events) | List timeline events for an incident. | 📖 |
| [`create_timeline_event`](workitems.md#create_timeline_event) | Create a timeline event on an incident. | ✏️ |

### [CI Lint](ci.md)

Validate `.gitlab-ci.yml` snippets and project pipeline configs. *(4 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=ci` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`validate_ci_lint`](ci.md#validate_ci_lint) | Validate provided GitLab CI/CD YAML content for a project. Checks without applying; create or update only after it passes. | 📖 |
| [`validate_project_ci_lint`](ci.md#validate_project_ci_lint) | Validate an existing .gitlab-ci.yml configuration for a project. Checks without applying; create or update only after it passes. | 📖 |
| [`list_ci_catalog_resources`](ci.md#list_ci_catalog_resources) | List GitLab CI/CD Catalog resources/components visible to the user. For one known resource, use the matching get tool. | 📖 |
| [`get_ci_catalog_resource`](ci.md#get_ci_catalog_resource) | Get details for a GitLab CI/CD Catalog resource, including versions and components. To find resources, use the matching list or search tool. | 📖 |

### [Pipelines, Jobs & Deployments](pipelines.md)

Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), project runners, and the deployments/environments view. *(58 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=core,pipelines` and `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint` (or `GITLAB_TOOLSETS=all`). If you already set `GITLAB_TOOLSETS`, append `pipelines` to your existing list instead of replacing it. If `GITLAB_TOOLS` is already set, append `validate_ci_lint,validate_project_ci_lint` instead of replacing that list. `USE_PIPELINE=true` is deprecated (removed in next major (v3.0.0)).

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_pipelines`](pipelines.md#list_pipelines) | List pipelines with filtering options. For one known resource, use the matching get tool. | 📖 |
| [`get_pipeline`](pipelines.md#get_pipeline) | Get details of a specific pipeline. To find resources, use the matching list or search tool. | 📖 |
| [`get_pipeline_variables`](pipelines.md#get_pipeline_variables) | Get variables configured for a pipeline. | 📖 |
| [`get_pipeline_test_report`](pipelines.md#get_pipeline_test_report) | Get pipeline test report. | 📖 |
| [`get_pipeline_test_report_summary`](pipelines.md#get_pipeline_test_report_summary) | Get pipeline test report summary. | 📖 |
| [`delete_pipeline`](pipelines.md#delete_pipeline) | Delete a pipeline. Requires the project Owner role, cannot be undone, and does not automatically delete child pipelines. Verify the target first with a get or list tool. | ✏️ |
| [`update_pipeline_metadata`](pipelines.md#update_pipeline_metadata) | Update pipeline metadata. | ✏️ |
| [`list_deployments`](pipelines.md#list_deployments) | List deployments with filtering options. For one known resource, use the matching get tool. | 📖 |
| [`get_deployment`](pipelines.md#get_deployment) | Get deployment details, including approval_summary, approvals, and pending_approval_count when GitLab provides them. To find resources, use the matching list or search tool. | 📖 |
| [`create_deployment`](pipelines.md#create_deployment) | Create a deployment. If the resource already exists, use the update tool. | ✏️ |
| [`update_deployment`](pipelines.md#update_deployment) | Update a deployment status. Use the create tool for new resources. | ✏️ |
| [`delete_deployment`](pipelines.md#delete_deployment) | Delete a deployment. Verify the target first with a get or list tool. | ✏️ |
| [`list_deployment_merge_requests`](pipelines.md#list_deployment_merge_requests) | List merge requests shipped with a deployment. | 📖 |
| [`approve_deployment`](pipelines.md#approve_deployment) | Approve or reject a protected-environment deployment. | ✏️ |
| [`list_environments`](pipelines.md#list_environments) | List environments in a project. For one known resource, use the matching get tool. | 📖 |
| [`get_environment`](pipelines.md#get_environment) | Get details of a specific environment. To find resources, use the matching list or search tool. | 📖 |
| [`update_environment`](pipelines.md#update_environment) | Update an environment. | ✏️ |
| [`delete_environment`](pipelines.md#delete_environment) | Delete a stopped environment. Verify the target first with a get or list tool. | ✏️ |
| [`stop_environment`](pipelines.md#stop_environment) | Stop an environment. | ✏️ |
| [`stop_stale_environments`](pipelines.md#stop_stale_environments) | Stop eligible stale environments; protected environments are excluded and environments are stopped, not deleted. Stop eligible stale environments. GitLab excludes protected environments; this does not delete them. | ✏️ |
| [`delete_review_app_environments`](pipelines.md#delete_review_app_environments) | Schedule deletion of stopped review-app environments one week later; dry_run defaults to true and actual scheduling requires dry_run=false. Schedule deletion of stopped review-app environments one week later. `dry_run` defaults to true. | ✏️ |
| [`list_pipeline_triggers`](pipelines.md#list_pipeline_triggers) | List project pipeline trigger tokens. For one known resource, use the matching get tool. | 📖 |
| [`get_pipeline_trigger`](pipelines.md#get_pipeline_trigger) | Get a project pipeline trigger. To find resources, use the matching list or search tool. | 📖 |
| [`create_pipeline_trigger`](pipelines.md#create_pipeline_trigger) | Create a project pipeline trigger. If the resource already exists, use the update tool. | ✏️ |
| [`update_pipeline_trigger`](pipelines.md#update_pipeline_trigger) | Update a project pipeline trigger. Use the create tool for new resources. | ✏️ |
| [`delete_pipeline_trigger`](pipelines.md#delete_pipeline_trigger) | Delete a project pipeline trigger. Verify the target first with a get or list tool. | ✏️ |
| [`trigger_pipeline`](pipelines.md#trigger_pipeline) | Trigger a pipeline with a pipeline trigger token. | ✏️ |
| [`list_pipeline_jobs`](pipelines.md#list_pipeline_jobs) | List all jobs in a specific pipeline. For one known resource, use the matching get tool. | 📖 |
| [`list_pipeline_trigger_jobs`](pipelines.md#list_pipeline_trigger_jobs) | List trigger jobs (bridges) in a pipeline. | 📖 |
| [`get_pipeline_job`](pipelines.md#get_pipeline_job) | Get details of a GitLab pipeline job number. To find resources, use the matching list or search tool. | 📖 |
| [`get_pipeline_job_output`](pipelines.md#get_pipeline_job_output) | Get a pipeline job trace. It is read-only. Without pattern, lines come from the end of the log: limit is the maximum lines (default and max 1000) and offset is how many lines to skip from the end (default 0). With pattern, the full log is searched and limit and offset are ignored; a log over 10,000,000 characters is searched only from the first line within its last 10,000,000 characters, and the result says which line that is. pattern is a substring unless regex is true, which treats it as a JavaScript regular expression; invalid expressions and patterns longer than 500 characters return an error. case_sensitive defaults to false. context_lines (default 5, maximum 50) includes lines before and after each match, and overlapping windows are merged. max_matches (default 20, maximum 100) caps returned matches, and returned lines stop at 100,000 characters of text in total. Results are plain text with 1-based line numbers from the start of the log plus total_lines, total_matches, shown_matches, truncated, and output_truncated (true when the character limit cut the output). ANSI escape codes and GitLab section_start/section_end markers are removed before matching and in returned fragments. Provide project_id as a numeric ID or URL-encoded path and job_id as the job ID. | 📖 |
| [`create_pipeline`](pipelines.md#create_pipeline) | Create a new pipeline for a branch or tag. | ✏️ |
| [`retry_pipeline`](pipelines.md#retry_pipeline) | Retry a failed or canceled pipeline. | ✏️ |
| [`cancel_pipeline`](pipelines.md#cancel_pipeline) | Cancel a running pipeline. | ✏️ |
| [`list_pipeline_schedules`](pipelines.md#list_pipeline_schedules) | List pipeline schedules in a project, optionally filtered to active or inactive. List scheduled pipelines (`cron`, `next_run_at`, `active`). The list has no `variables` — call `get_pipeline_schedule` for those. | 📖 |
| [`get_pipeline_schedule`](pipelines.md#get_pipeline_schedule) | Get details of a specific pipeline schedule, including its variables and last pipeline. Inspect one schedule including variables and inputs (Maintainer/Owner/schedule owner only). | 📖 |
| [`list_pipeline_schedule_pipelines`](pipelines.md#list_pipeline_schedule_pipelines) | List the pipelines that a pipeline schedule has triggered. List pipelines a schedule has triggered. Use `get_pipeline` for one pipeline and `list_pipelines` for project-wide filtering. | 📖 |
| [`create_pipeline_schedule`](pipelines.md#create_pipeline_schedule) | Create a new pipeline schedule for a branch or tag. Add a recurring pipeline. Prefer a full ref such as `refs/heads/main` when a branch and tag share a name. `cron_timezone` defaults to UTC. | ✏️ |
| [`update_pipeline_schedule`](pipelines.md#update_pipeline_schedule) | Update an existing pipeline schedule. Change an existing schedule. Call `take_ownership_pipeline_schedule` first when the schedule belongs to another user. | ✏️ |
| [`delete_pipeline_schedule`](pipelines.md#delete_pipeline_schedule) | Delete a pipeline schedule. Permanently remove a schedule and its variables. Pause with `update_pipeline_schedule` `active: false` instead when possible. | ✏️ |
| [`play_pipeline_schedule`](pipelines.md#play_pipeline_schedule) | Run a pipeline schedule immediately. Run a schedule immediately without shifting `next_run_at`. Rate-limited to once per minute per schedule. | ✏️ |
| [`take_ownership_pipeline_schedule`](pipelines.md#take_ownership_pipeline_schedule) | Take ownership of a pipeline schedule. Transfer schedule ownership to the current user. Required before updating or deleting someone else's schedule. | ✏️ |
| [`get_pipeline_schedule_variable`](pipelines.md#get_pipeline_schedule_variable) | Get a single variable of a pipeline schedule. Read one schedule variable by key. Separate from project-level CI/CD variables. | 📖 |
| [`create_pipeline_schedule_variable`](pipelines.md#create_pipeline_schedule_variable) | Create a variable for a pipeline schedule. Attach a new variable to a schedule. `variable_type` defaults to `env_var`; `key` is /[a-zA-Z0-9_]+/ up to 255 characters. | ✏️ |
| [`update_pipeline_schedule_variable`](pipelines.md#update_pipeline_schedule_variable) | Update a variable of a pipeline schedule. Change the value or type of an existing schedule variable. | ✏️ |
| [`delete_pipeline_schedule_variable`](pipelines.md#delete_pipeline_schedule_variable) | Delete a variable from a pipeline schedule. Permanently remove a schedule variable. Later scheduled pipelines no longer receive it. | ✏️ |
| [`play_pipeline_job`](pipelines.md#play_pipeline_job) | Run a manual pipeline job. | ✏️ |
| [`play_pipeline_jobs`](pipelines.md#play_pipeline_jobs) | Play multiple manual pipeline jobs sequentially. | ✏️ |
| [`retry_pipeline_job`](pipelines.md#retry_pipeline_job) | Retry a failed or canceled pipeline job. | ✏️ |
| [`cancel_pipeline_job`](pipelines.md#cancel_pipeline_job) | Cancel a running pipeline job. | ✏️ |
| [`erase_pipeline_job`](pipelines.md#erase_pipeline_job) | Erase a pipeline job log and artifacts. | ✏️ |
| [`wait_for_pipeline`](pipelines.md#wait_for_pipeline) | Wait for a pipeline to reach a terminal status. | 📖 |
| [`wait_for_job`](pipelines.md#wait_for_job) | Wait for a job to reach a terminal status. | 📖 |
| [`list_job_artifacts`](pipelines.md#list_job_artifacts) | List artifact files in a job's archive. | 📖 |
| [`download_job_artifacts`](pipelines.md#download_job_artifacts) | Download job artifact archive (zip) and save to a local path. Retrieve a job artifact archive. Remote HTTP returns a download URL; local stdio saves a file (rejected in readonly mode). | 📖✏️ |
| [`get_job_artifact_file`](pipelines.md#get_job_artifact_file) | Get content of a single file from a job's artifacts. | 📖 |
| [`list_project_runners`](pipelines.md#list_project_runners) | List runners available to a project. List runners a project can use, including ancestor group and allowed instance runners. Payload omits tags — call `get_runner` for tag_list. Never returns runners_token or the runner authentication token. | 📖 |
| [`get_runner`](pipelines.md#get_runner) | Get one runner by ID. Get tag_list, run_untagged, locked, and access_level for a runner id. With GITLAB_ALLOWED_PROJECT_IDS or a session project scope, the runner must appear on an allowed project's list — pass project_id when more than one project is allowed. Never returns runners_token or the runner authentication token; token_expires_at is expiry metadata, not the token. | 📖 |

### [Milestones](milestones.md)

Project and group milestone CRUD plus associated issues/MRs and burndown events. *(17 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=core,milestones` (or `GITLAB_TOOLSETS=all`). If you already set `GITLAB_TOOLSETS`, append `milestones` to your existing list instead of replacing it. `USE_MILESTONE=true` is deprecated (removed in next major (v3.0.0)).

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_milestones`](milestones.md#list_milestones) | List milestones with filtering options. For one known resource, use the matching get tool. | 📖 |
| [`get_milestone`](milestones.md#get_milestone) | Get details of a specific milestone. To find resources, use the matching list or search tool. | 📖 |
| [`create_milestone`](milestones.md#create_milestone) | Create a new milestone. If the resource already exists, use the update tool. | ✏️ |
| [`edit_milestone`](milestones.md#edit_milestone) | Edit an existing milestone. Use the create tool for new resources. | ✏️ |
| [`delete_milestone`](milestones.md#delete_milestone) | Delete a milestone. Verify the target first with a get or list tool. | ✏️ |
| [`get_milestone_issue`](milestones.md#get_milestone_issue) | Get issues associated with a specific milestone. | 📖 |
| [`get_milestone_merge_requests`](milestones.md#get_milestone_merge_requests) | Get merge requests associated with a specific milestone. | 📖 |
| [`promote_milestone`](milestones.md#promote_milestone) | Promote a milestone to the next stage. | ✏️ |
| [`get_milestone_burndown_events`](milestones.md#get_milestone_burndown_events) | Get burndown events for a specific milestone. | 📖 |
| [`list_group_milestones`](milestones.md#list_group_milestones) | List group milestones with filtering options. For one known resource, use the matching get tool. | 📖 |
| [`get_group_milestone`](milestones.md#get_group_milestone) | Get details of a specific group milestone. To find resources, use the matching list or search tool. | 📖 |
| [`create_group_milestone`](milestones.md#create_group_milestone) | Create a new group milestone. If the resource already exists, use the update tool. | ✏️ |
| [`edit_group_milestone`](milestones.md#edit_group_milestone) | Edit an existing group milestone. Use the create tool for new resources. | ✏️ |
| [`delete_group_milestone`](milestones.md#delete_group_milestone) | Delete a group milestone. Verify the target first with a get or list tool. | ✏️ |
| [`get_group_milestone_issue`](milestones.md#get_group_milestone_issue) | Get issues associated with a specific group milestone. | 📖 |
| [`get_group_milestone_merge_requests`](milestones.md#get_group_milestone_merge_requests) | Get merge requests associated with a specific group milestone. | 📖 |
| [`get_group_milestone_burndown_events`](milestones.md#get_group_milestone_burndown_events) | Get burndown events for a specific group milestone. | 📖 |

### [Wiki](wiki.md)

Project and group wiki page CRUD. Attachment uploads where supported. *(10 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=core,wiki` (or `GITLAB_TOOLSETS=all`). If you already set `GITLAB_TOOLSETS`, append `wiki` to your existing list instead of replacing it. `USE_GITLAB_WIKI=true` is deprecated (removed in next major (v3.0.0)).

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_wiki_pages`](wiki.md#list_wiki_pages) | List wiki pages in a project. For one known resource, use the matching get tool. | 📖 |
| [`get_wiki_page`](wiki.md#get_wiki_page) | Get details of a specific wiki page. To find resources, use the matching list or search tool. | 📖 |
| [`create_wiki_page`](wiki.md#create_wiki_page) | Create a wiki page in a project. If the resource already exists, use the update tool. | ✏️ |
| [`update_wiki_page`](wiki.md#update_wiki_page) | Update a wiki page in a project. Use the create tool for new resources. | ✏️ |
| [`delete_wiki_page`](wiki.md#delete_wiki_page) | Delete a wiki page from a project. Verify the target first with a get or list tool. | ✏️ |
| [`list_group_wiki_pages`](wiki.md#list_group_wiki_pages) | List wiki pages in a group. For one known resource, use the matching get tool. | 📖 |
| [`get_group_wiki_page`](wiki.md#get_group_wiki_page) | Get details of a specific group wiki page. To find resources, use the matching list or search tool. | 📖 |
| [`create_group_wiki_page`](wiki.md#create_group_wiki_page) | Create a wiki page in a group. If the resource already exists, use the update tool. | ✏️ |
| [`update_group_wiki_page`](wiki.md#update_group_wiki_page) | Update a wiki page in a group. Use the create tool for new resources. | ✏️ |
| [`delete_group_wiki_page`](wiki.md#delete_group_wiki_page) | Delete a wiki page from a group. Verify the target first with a get or list tool. | ✏️ |

### [Releases](releases.md)

Release lifecycle, release evidence, and asset download. *(7 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=releases` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_releases`](releases.md#list_releases) | List all releases for a project. For one known resource, use the matching get tool. | 📖 |
| [`get_release`](releases.md#get_release) | Get a release by tag name. To find resources, use the matching list or search tool. | 📖 |
| [`create_release`](releases.md#create_release) | Create a new release. If the resource already exists, use the update tool. | ✏️ |
| [`update_release`](releases.md#update_release) | Update an existing release. Use the create tool for new resources. | ✏️ |
| [`delete_release`](releases.md#delete_release) | Delete a release (does not delete the tag). Verify the target first with a get or list tool. | ✏️ |
| [`create_release_evidence`](releases.md#create_release_evidence) | Create release evidence (Premium/Ultimate). | ✏️ |
| [`download_release_asset`](releases.md#download_release_asset) | Download a release asset file by direct asset path. | 📖 |

### [Tags](tags.md)

Tag listing, creation, deletion, signature inspection, and protected tag rules. *(9 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=tags` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_tags`](tags.md#list_tags) | List repository tags for a project. For one known resource, use the matching get tool. | 📖 |
| [`get_tag`](tags.md#get_tag) | Get a repository tag by name. To find resources, use the matching list or search tool. | 📖 |
| [`create_tag`](tags.md#create_tag) | Create a new repository tag. | ✏️ |
| [`delete_tag`](tags.md#delete_tag) | Delete a repository tag. Verify the target first with a get or list tool. | ✏️ |
| [`get_tag_signature`](tags.md#get_tag_signature) | Get the X.509 signature of a signed tag (404 if unsigned). | 📖 |
| [`list_protected_tags`](tags.md#list_protected_tags) | List protected tags in a project. For one known resource, use the matching get tool. | 📖 |
| [`get_protected_tag`](tags.md#get_protected_tag) | Get details of a single protected tag or wildcard (create access levels). To find resources, use the matching list or search tool. | 📖 |
| [`protect_tag`](tags.md#protect_tag) | Protect a repository tag or wildcard (set who can create it). Protect a tag or wildcard such as `v*` so protected CI/CD variables reach tag pipelines. Inspect first with `get_protected_tag` or `list_protected_tags`. | ✏️ |
| [`unprotect_tag`](tags.md#unprotect_tag) | Remove protection from a previously protected tag or wildcard. Remove tag protection. To change create access, `unprotect_tag` then `protect_tag`. Blocked in `modify` mode. | ✏️ |

### [Users & Events](users.md)

User lookup, the authenticated user (`whoami`), event streams, and markdown attachment upload/download. *(7 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=users` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool. 1 of these tools (`whoami`) are already enabled by default via `core`; the toggle applies to the rest.

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_users`](users.md#get_users) | Get GitLab user details by usernames. | 📖 |
| [`get_user`](users.md#get_user) | Get user details by ID. | 📖 |
| [`whoami`](users.md#whoami) | Get current authenticated user details. Requires classic read_user or fine-grained User:Read. Use `get_user` or `get_users` to look up another user. | 📖 |
| [`list_events`](users.md#list_events) | List events for the authenticated user (before/after: YYYY-MM-DD). | 📖 |
| [`get_project_events`](users.md#get_project_events) | List events for a project (before/after: YYYY-MM-DD). | 📖 |
| [`upload_markdown`](users.md#upload_markdown) | Upload a file for use in markdown content. | ✏️ |
| [`download_attachment`](users.md#download_attachment) | Download an uploaded file from a project (images returned as base64; other files, or images with local_path, are saved as new files under the download directory). Retrieve a project attachment. Remote HTTP returns inline base64 or a URL; local stdio saves under GITLAB_DOWNLOAD_DIR and never overwrites. | 📖✏️ |

### [Variables](variables.md)

Project and group CI/CD variable CRUD. *(10 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=variables` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_project_variables`](variables.md#list_project_variables) | List CI/CD variables for a project. For one known resource, use the matching get tool. | 📖 |
| [`get_project_variable`](variables.md#get_project_variable) | Get a single CI/CD variable from a project. To find resources, use the matching list or search tool. | 📖 |
| [`create_project_variable`](variables.md#create_project_variable) | Create a CI/CD variable for a project. If the resource already exists, use the update tool. | ✏️ |
| [`update_project_variable`](variables.md#update_project_variable) | Update an existing CI/CD variable in a project. Use the create tool for new resources. | ✏️ |
| [`delete_project_variable`](variables.md#delete_project_variable) | Delete a CI/CD variable from a project. Verify the target first with a get or list tool. | ✏️ |
| [`list_group_variables`](variables.md#list_group_variables) | List CI/CD variables for a group. For one known resource, use the matching get tool. | 📖 |
| [`get_group_variable`](variables.md#get_group_variable) | Get a single CI/CD variable from a group. To find resources, use the matching list or search tool. | 📖 |
| [`create_group_variable`](variables.md#create_group_variable) | Create a CI/CD variable for a group. If the resource already exists, use the update tool. | ✏️ |
| [`update_group_variable`](variables.md#update_group_variable) | Update an existing CI/CD variable in a group. Use the create tool for new resources. | ✏️ |
| [`delete_group_variable`](variables.md#delete_group_variable) | Delete a CI/CD variable from a group. Verify the target first with a get or list tool. | ✏️ |

### [Webhooks](webhooks.md)

Create, update, and delete project or group webhooks, and inspect recent webhook events. *(6 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=webhooks` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_webhooks`](webhooks.md#list_webhooks) | List webhooks for a project or group. | 📖 |
| [`create_webhook`](webhooks.md#create_webhook) | Create a webhook on a project or group. If the resource already exists, use the update tool. | ✏️ |
| [`update_webhook`](webhooks.md#update_webhook) | Update an existing project or group webhook. Use the create tool for new resources. | ✏️ |
| [`delete_webhook`](webhooks.md#delete_webhook) | Delete a project or group webhook. Verify the target first with a get or list tool. | ✏️ |
| [`list_webhook_events`](webhooks.md#list_webhook_events) | List recent webhook events (past 7 days). For one known resource, use the matching get tool. | 📖 |
| [`get_webhook_event`](webhooks.md#get_webhook_event) | Get full details of a specific webhook event. To find resources, use the matching list or search tool. | 📖 |

### [Search](search.md)

Code search across all visible projects, a specific project, or a specific group. *(3 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=search` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`search_code`](search.md#search_code) | Search for code across all projects (requires advanced search or Zoekt). If the identifier is known, use a typed get or list tool. | 📖 |
| [`search_project_code`](search.md#search_project_code) | Search for code within a specific project (requires advanced search or Zoekt). If the identifier is known, use a typed get or list tool. | 📖 |
| [`search_group_code`](search.md#search_group_code) | Search for code within a specific group (requires advanced search or Zoekt). If the identifier is known, use a typed get or list tool. | 📖 |

### [Dependency Proxy](dependency-proxy.md)

Inspect and manage the GitLab dependency proxy cache settings, blob storage, and purge operations. *(4 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=dependency_proxy` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_dependency_proxy_settings`](dependency-proxy.md#get_dependency_proxy_settings) | Get dependency proxy settings for a group. | 📖 |
| [`update_dependency_proxy_settings`](dependency-proxy.md#update_dependency_proxy_settings) | Update dependency proxy settings for a group (enable/disable, credentials for authenticated Docker Hub pulls). | ✏️ |
| [`list_dependency_proxy_blobs`](dependency-proxy.md#list_dependency_proxy_blobs) | List cached dependency proxy blobs for a group. | 📖 |
| [`purge_dependency_proxy_cache`](dependency-proxy.md#purge_dependency_proxy_cache) | Schedule purge of all cached dependency proxy blobs for a group. | ✏️ |

### [Vulnerabilities](vulnerabilities.md)

AI-assisted vulnerability triage — list findings, inspect details, dismiss with reason, or confirm for remediation. Backed by the GitLab GraphQL API; requires GitLab Ultimate. *(4 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=vulnerabilities` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_project_vulnerabilities`](vulnerabilities.md#list_project_vulnerabilities) | List vulnerabilities for a project with optional state, severity, and report type filters (GraphQL-backed, cursor pagination). | 📖 |
| [`get_vulnerability`](vulnerabilities.md#get_vulnerability) | Get full details of a specific vulnerability. | 📖 |
| [`dismiss_vulnerability`](vulnerabilities.md#dismiss_vulnerability) | Dismiss a vulnerability with a reason (acceptable_risk, false_positive, used_in_tests, mitigating_control, not_applicable) and optional comment. | ✏️ |
| [`confirm_vulnerability`](vulnerabilities.md#confirm_vulnerability) | Confirm a vulnerability as a real finding requiring remediation. | ✏️ |

### [GitLab Orbit](orbit.md)

Query the Orbit SDLC knowledge graph (Beta; Premium/Ultimate). Graph queries consume GitLab credits; schema, status, and tool listing are free. *(4 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=orbit` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`orbit_query`](orbit.md#orbit_query) | Execute a GitLab Orbit graph query over the indexed SDLC knowledge graph. Answer cross-project relationship questions in one call. Premium/Ultimate; each call consumes GitLab credits. Use `orbit_get_schema` first when types are unknown. | 📖 |
| [`orbit_get_schema`](orbit.md#orbit_get_schema) | Fetch the current GitLab Orbit graph schema (node and edge types). List node and edge types for `orbit_query`. Read-only and free of credit charges. | 📖 |
| [`orbit_get_status`](orbit.md#orbit_get_status) | Check GitLab Orbit indexing status for the enabled scope. Check whether Orbit indexing has completed. Results reflect the last index cycle. | 📖 |
| [`orbit_list_tools`](orbit.md#orbit_list_tools) | List the MCP tool definitions exposed by GitLab Orbit. List MCP tool definitions Orbit itself exposes. Use `orbit_query` to run graph queries. | 📖 |

### [Snippets](snippets.md)

Snippet CRUD — list, get (with optional file content), create, update, and delete personal or project snippets. *(5 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=snippets` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_snippets`](snippets.md#list_snippets) | List snippets — project snippets when project_id is given, otherwise personal snippets. For one known resource, use the matching get tool. | 📖 |
| [`get_snippet`](snippets.md#get_snippet) | Get a snippet's metadata. Set include_content=true to also fetch the raw file content. To find resources, use the matching list or search tool. | 📖 |
| [`create_snippet`](snippets.md#create_snippet) | Create a snippet — project-scoped when project_id is given, otherwise a personal snippet. Requires title plus either file_name + content (single file) or files[] (multi-file); the two shapes cannot be mixed. If the resource already exists, use the update tool. | ✏️ |
| [`update_snippet`](snippets.md#update_snippet) | Update an existing snippet (provide at least one field to change). For multi-file edits — renames, deletions, additions — pass files[] with action (create/update/delete/move) and previous_path. The file_name + content shortcut still works for single-file content replacement. Use the create tool for new resources. | ✏️ |
| [`delete_snippet`](snippets.md#delete_snippet) | Delete a snippet. Verify the target first with a get or list tool. | ✏️ |

### [Raw API](api.md)

Explicit opt-in escape hatch for one GitLab REST call under /api/v4. Not part of core, not enabled by GITLAB_TOOLSETS=all, and not activatable with discover_tools. *(1 tools)*

> Explicit opt-in only. Enable by listing `api` in `GITLAB_TOOLSETS` (for example `GITLAB_TOOLSETS=api` or `GITLAB_TOOLSETS=core,api`). `GITLAB_TOOLSETS=all`, `discover_tools`, `GITLAB_TOOLS`, legacy `USE_*` flags, and `GITLAB_TOOL_PROFILE` do not enable it.

| Tool | What it does | R/W |
|---|---|:-:|
| [`gitlab_api_request`](api.md#gitlab_api_request) | DANGER: bypasses group and project restrictions, tool allowlists (GITLAB_TOOLS and GITLAB_DENIED_TOOLS_REGEX on other tools), and individual tool safety checks. The full token scope is exposed. Send one GitLab REST call under /api/v4. Readonly allows GET only; modify rejects DELETE. Enable only by listing api in GITLAB_TOOLSETS; all, discover_tools, and GITLAB_TOOLS do not. Prompt injection can drive this tool, so operators who rely on group, project, or tool restrictions must not enable it. With GITLAB_ALLOWED_PROJECT_IDS or a session project scope, only /projects/:id paths for an allowed project are accepted; body and query parameters that name another project are not checked. | 📖✏️ |

### [Meta & GraphQL](meta.md)

Server diagnostics, tool discovery, and the GraphQL escape hatch. *(3 tools)*

> Mixed availability. `discover_tools` and `help` are always exposed (the server re-adds them after every toolset filter). `execute_graphql` is not part of any toolset — enable it explicitly with `GITLAB_TOOLS=execute_graphql`. Tools excluded from the list (toolset / `GITLAB_TOOLS` / `GITLAB_DENIED_TOOLS_REGEX`) are also rejected on direct calls; `GITLAB_TOOL_POLICY_HIDDEN` tools stay callable only while they are otherwise enabled (toolset / `GITLAB_TOOLS` / permission mode) and do not match `GITLAB_DENIED_TOOLS_REGEX`; hiding a tool does not enable it.

| Tool | What it does | R/W |
|---|---|:-:|
| [`execute_graphql`](meta.md#execute_graphql) | Execute a GitLab GraphQL query. Use only when no typed REST tool covers the operation. The query is sent directly and may include mutations. | 📖✏️ |
| [`discover_tools`](meta.md#discover_tools) | Discover and activate additional tool categories for this session. Available categories: core, merge_requests, issues, repositories, branches, projects, labels, ci, groups, pipelines, milestones, wiki, releases, tags, snippets, users, workitems, webhooks, search, variables, dependency_proxy, vulnerabilities, orbit. Already-active categories are listed in the response. Explicit-only toolsets are omitted; list them in GITLAB_TOOLSETS. | 📖 |
| [`help`](meta.md#help) | Return a short GitLab workflow guide. Omit topic for the overview and topic list. Use this for a short workflow guide (code-review, pipelines, issues, token-saving). Omit topic for the overview. Detailed GitLab operations stay on the typed tools. | 📖 |

---

## Argument schemas

Each group page includes a parameter table per tool, generated from
the authoritative Zod schemas in
[`schemas.ts`](https://github.com/zereight/gitlab-mcp/blob/main/schemas.ts).
For runtime schema inspection from a connected MCP client, call the
`discover_tools` tool.