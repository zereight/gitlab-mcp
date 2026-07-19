# Tools Reference

Complete catalog of every tool the GitLab MCP server exposes.

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
| **Default** — always exposed | [Projects & Namespaces](projects.md), [Projects & Files](repositories.md), [Branches & Commits](branches.md), [Groups](groups.md), [Merge Requests](merge-requests.md), [Issues](issues.md), [Labels](labels.md), [CI Lint](ci.md), [Users & Events](users.md) |
| **Opt-in** — must be enabled | [Work Items](workitems.md), [Pipelines, Jobs & Deployments](pipelines.md) (also `USE_PIPELINE=true`), [Milestones](milestones.md) (also `USE_MILESTONE=true`), [Wiki](wiki.md) (also `USE_GITLAB_WIKI=true`), [Releases](releases.md), [Tags](tags.md), [Variables](variables.md), [Webhooks](webhooks.md), [Search](search.md), [Dependency Proxy](dependency-proxy.md), [Meta & GraphQL](meta.md) |

**How to enable opt-in groups** (any one is sufficient):

- `GITLAB_TOOLSETS=<group,…>` — comma-separated toolset IDs.
- `GITLAB_TOOLSETS=all` — enables every group.
- `GITLAB_TOOLS=<tool,…>` — enables individual tools regardless of group.
- `USE_PIPELINE=true` / `USE_MILESTONE=true` / `USE_GITLAB_WIKI=true` — legacy single-group flags (Pipelines, Milestones, Wiki only).
- Call the `discover_tools` MCP tool at runtime to activate categories for the current session.

Permission modes control which tools are exposed:

- `GITLAB_PERMISSION_MODE=readonly` — hides every write tool regardless of toggles.
- `GITLAB_PERMISSION_MODE=modify` — allows create/update but blocks all `delete_*` tools.
- `GITLAB_READ_ONLY_MODE=true` (deprecated) — same as `readonly`; prefer `GITLAB_PERMISSION_MODE=readonly`.

See [Environment Variables](../configuration/environment-variables.md)
and [CLI Arguments](../getting-started/cli-arguments.md) for the full list.

## Legend

| Marker | Meaning |
|---|---|
| 📖 | **Read-only** — fetches data, does not modify GitLab state. Safe to invoke freely. |
| ✏️ | **Writes** — creates, updates, or deletes data on GitLab. Confirm intent before running. |

## Browse by group

Each group has its own page with full parameter tables — click any tool name to jump to its details, or click the group title for the per-group view.

### [Projects & Namespaces](projects.md)

Project/namespace listing, member queries, group iterations, and server health. *(10 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_project`](projects.md#get_project) | Get details of a specific project | 📖 |
| [`list_projects`](projects.md#list_projects) | List projects accessible by the current user | 📖 |
| [`update_project`](projects.md#update_project) | Update project settings such as description, visibility, default branch, and feature access levels | ✏️ |
| [`list_project_members`](projects.md#list_project_members) | List members of a GitLab project | 📖 |
| [`list_namespaces`](projects.md#list_namespaces) | List all namespaces (users and groups) available to the current user. Filter by kind='group' for groups only. | 📖 |
| [`get_namespace`](projects.md#get_namespace) | Get details of a namespace (user or group) by ID or path. Groups are namespaces with kind='group'. | 📖 |
| [`verify_namespace`](projects.md#verify_namespace) | Verify if a namespace path exists. Use parent_id to scope the check to a specific parent namespace — required for nested namespaces where the same path may exist under different parents. | 📖 |
| [`list_group_projects`](projects.md#list_group_projects) | List projects in a group | 📖 |
| [`list_group_iterations`](projects.md#list_group_iterations) | List group iterations with filtering options | 📖 |
| [`health_check`](projects.md#health_check) | Verify server status and authentication | 📖 |

### [Projects & Files](repositories.md)

Project search/creation/fork plus the Files API for reading and writing repository content without shelling out to git. *(7 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`search_repositories`](repositories.md#search_repositories) | Search for GitLab projects | 📖 |
| [`create_repository`](repositories.md#create_repository) | Create a new GitLab project | ✏️ |
| [`get_file_contents`](repositories.md#get_file_contents) | Get contents of a file or directory from a GitLab project | 📖 |
| [`push_files`](repositories.md#push_files) | Push multiple files in a single commit | ✏️ |
| [`create_or_update_file`](repositories.md#create_or_update_file) | Create or update a file in a GitLab project | ✏️ |
| [`fork_repository`](repositories.md#fork_repository) | Fork a project to your account or specified namespace | ✏️ |
| [`get_repository_tree`](repositories.md#get_repository_tree) | List files and directories in a repository | 📖 |

### [Branches & Commits](branches.md)

Branch management, commit listing/inspection, file blame, and CI commit-status manipulation. *(15 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`create_branch`](branches.md#create_branch) | Create a new branch | ✏️ |
| [`get_branch`](branches.md#get_branch) | Get branch details (commit, protection status) | 📖 |
| [`list_branches`](branches.md#list_branches) | List branches in project with search filter | 📖 |
| [`delete_branch`](branches.md#delete_branch) | Delete branch from project | ✏️ |
| [`list_protected_branches`](branches.md#list_protected_branches) | List protected branches in a project, supports search filter | 📖 |
| [`get_protected_branch`](branches.md#get_protected_branch) | Get details of a single protected branch (access levels, force push settings) | 📖 |
| [`protect_branch`](branches.md#protect_branch) | Protect a repository branch (set push/merge/unprotect access levels) | ✏️ |
| [`unprotect_branch`](branches.md#unprotect_branch) | Remove protection from a previously protected branch | ✏️ |
| [`update_default_branch`](branches.md#update_default_branch) | Change the default branch of a project | ✏️ |
| [`list_commits`](branches.md#list_commits) | List repository commits with filtering options | 📖 |
| [`get_commit`](branches.md#get_commit) | Get details of a specific commit | 📖 |
| [`get_commit_diff`](branches.md#get_commit_diff) | Get changes/diffs of a specific commit | 📖 |
| [`get_file_blame`](branches.md#get_file_blame) | Get git blame for a file at a given ref. Each entry maps a contiguous range of source lines to the commit that last changed them (id, author, authored_date, message). Use range_start/range_end to limit blame to specific lines. | 📖 |
| [`list_commit_statuses`](branches.md#list_commit_statuses) | List statuses for a commit | 📖 |
| [`create_commit_status`](branches.md#create_commit_status) | Create or update the status of a commit | ✏️ |

### [Groups](groups.md)

Create new groups and subgroups. *(1 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`create_group`](groups.md#create_group) | Create new group or subgroup | ✏️ |

### [Merge Requests](merge-requests.md)

MR lifecycle — create, update, merge, approve, plus diff/conflict inspection and the full discussion/note/draft API. *(43 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`merge_merge_request`](merge-requests.md#merge_merge_request) | Merge a merge request | ✏️ |
| [`approve_merge_request`](merge-requests.md#approve_merge_request) | Approve a merge request | ✏️ |
| [`unapprove_merge_request`](merge-requests.md#unapprove_merge_request) | Unapprove a merge request | ✏️ |
| [`get_merge_request_approval_state`](merge-requests.md#get_merge_request_approval_state) | Get merge request approval details including approvers | 📖 |
| [`get_branch`](merge-requests.md#get_branch) | Get branch details (commit, protection status) | 📖 |
| [`list_branches`](merge-requests.md#list_branches) | List branches in project with search filter | 📖 |
| [`get_merge_request_conflicts`](merge-requests.md#get_merge_request_conflicts) | Get the conflicts of a merge request | 📖 |
| [`list_merge_request_pipelines`](merge-requests.md#list_merge_request_pipelines) | List pipelines for a merge request with pagination | 📖 |
| [`get_merge_request`](merge-requests.md#get_merge_request) | Get details of a merge request (mergeRequestIid or branchName required). Set include_summaries=true for deployment/commit/approval summaries | 📖 |
| [`get_merge_request_diffs`](merge-requests.md#get_merge_request_diffs) | Get the changes/diffs of a merge request (mergeRequestIid or branchName required) | 📖 |
| [`list_merge_request_changed_files`](merge-requests.md#list_merge_request_changed_files) | List changed file paths in a merge request without diff content (mergeRequestIid or branchName required) | 📖 |
| [`list_merge_request_diffs`](merge-requests.md#list_merge_request_diffs) | List merge request diffs with pagination (mergeRequestIid or branchName required) | 📖 |
| [`get_merge_request_file_diff`](merge-requests.md#get_merge_request_file_diff) | Get diffs for specific files from a merge request (mergeRequestIid or branchName required) | 📖 |
| [`list_merge_request_versions`](merge-requests.md#list_merge_request_versions) | List all versions of a merge request | 📖 |
| [`get_merge_request_version`](merge-requests.md#get_merge_request_version) | Get a specific version of a merge request | 📖 |
| [`update_merge_request`](merge-requests.md#update_merge_request) | Update a merge request (mergeRequestIid or branchName required) | ✏️ |
| [`create_merge_request`](merge-requests.md#create_merge_request) | Create a new merge request | ✏️ |
| [`list_merge_requests`](merge-requests.md#list_merge_requests) | List merge requests (without project_id: user's MRs; with project_id: project MRs) | 📖 |
| [`get_branch_diffs`](merge-requests.md#get_branch_diffs) | Get diffs between two branches or commits | 📖 |
| [`mr_discussions`](merge-requests.md#mr_discussions) | List discussion items for a merge request | 📖 |
| [`create_merge_request_note`](merge-requests.md#create_merge_request_note) | Add a new note to a merge request | ✏️ |
| [`update_merge_request_note`](merge-requests.md#update_merge_request_note) | Modify an existing merge request note | ✏️ |
| [`delete_merge_request_note`](merge-requests.md#delete_merge_request_note) | Delete an existing merge request note | ✏️ |
| [`get_merge_request_note`](merge-requests.md#get_merge_request_note) | Get a specific note for a merge request | 📖 |
| [`get_merge_request_notes`](merge-requests.md#get_merge_request_notes) | List notes for a merge request | 📖 |
| [`delete_merge_request_discussion_note`](merge-requests.md#delete_merge_request_discussion_note) | Delete a discussion note on a merge request | ✏️ |
| [`update_merge_request_discussion_note`](merge-requests.md#update_merge_request_discussion_note) | Update a discussion note on a merge request | ✏️ |
| [`create_merge_request_discussion_note`](merge-requests.md#create_merge_request_discussion_note) | Add a new discussion note to an existing merge request thread | ✏️ |
| [`get_draft_note`](merge-requests.md#get_draft_note) | Get a single draft note from a merge request | 📖 |
| [`list_draft_notes`](merge-requests.md#list_draft_notes) | List draft notes for a merge request | 📖 |
| [`create_draft_note`](merge-requests.md#create_draft_note) | Create a draft note for a merge request | ✏️ |
| [`update_draft_note`](merge-requests.md#update_draft_note) | Update an existing draft note | ✏️ |
| [`delete_draft_note`](merge-requests.md#delete_draft_note) | Delete a draft note | ✏️ |
| [`publish_draft_note`](merge-requests.md#publish_draft_note) | Publish a single draft note | ✏️ |
| [`bulk_publish_draft_notes`](merge-requests.md#bulk_publish_draft_notes) | Publish all draft notes for a merge request. Optionally sets reviewer_state and posts a summary note (GitLab 19.2+). Can set reviewer_state even with no drafts. | ✏️ |
| [`create_merge_request_thread`](merge-requests.md#create_merge_request_thread) | Create a new thread on a merge request | ✏️ |
| [`resolve_merge_request_thread`](merge-requests.md#resolve_merge_request_thread) | Resolve a thread on a merge request | ✏️ |
| [`list_merge_request_emoji_reactions`](merge-requests.md#list_merge_request_emoji_reactions) | List all emoji reactions on a merge request | 📖 |
| [`list_merge_request_note_emoji_reactions`](merge-requests.md#list_merge_request_note_emoji_reactions) | List all emoji reactions on a merge request note. Pass discussion_id for discussion thread replies. | 📖 |
| [`create_merge_request_emoji_reaction`](merge-requests.md#create_merge_request_emoji_reaction) | Add an emoji reaction to a merge request (e.g. thumbsup, rocket, eyes) | ✏️ |
| [`delete_merge_request_emoji_reaction`](merge-requests.md#delete_merge_request_emoji_reaction) | Remove an emoji reaction from a merge request | ✏️ |
| [`create_merge_request_note_emoji_reaction`](merge-requests.md#create_merge_request_note_emoji_reaction) | Add an emoji reaction to a merge request note. Pass discussion_id for discussion thread replies. | ✏️ |
| [`delete_merge_request_note_emoji_reaction`](merge-requests.md#delete_merge_request_note_emoji_reaction) | Remove an emoji reaction from a merge request note. Pass discussion_id for discussion thread replies. | ✏️ |

### [Issues](issues.md)

Issue CRUD, links, discussions and notes, todos, and emoji reactions. *(24 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`create_issue`](issues.md#create_issue) | Create a new issue | ✏️ |
| [`list_issues`](issues.md#list_issues) | List issues (default: created by current user; use scope='all' for all) | 📖 |
| [`my_issues`](issues.md#my_issues) | List issues assigned to the authenticated user | 📖 |
| [`get_issue`](issues.md#get_issue) | Get details of a specific issue. Returns a slim milestone by default; set full_response=true for the complete milestone object | 📖 |
| [`update_issue`](issues.md#update_issue) | Update an issue. Returns a slim confirmation by default; set full_response=true for the complete updated issue object | ✏️ |
| [`update_issue_description_patch`](issues.md#update_issue_description_patch) | Apply a patch (search/replace or unified diff) to an issue description. Reduces token usage by allowing small changes without sending the full description. Supports dry_run to preview changes and create_note to summarize updates. | ✏️ |
| [`delete_issue`](issues.md#delete_issue) | Delete an issue | ✏️ |
| [`list_todos`](issues.md#list_todos) | List GitLab to-do items for the current user | 📖 |
| [`mark_todo_done`](issues.md#mark_todo_done) | Mark a GitLab to-do item as done | ✏️ |
| [`mark_all_todos_done`](issues.md#mark_all_todos_done) | Mark all pending GitLab to-do items as done for the current user | ✏️ |
| [`create_issue_note`](issues.md#create_issue_note) | Add a note to an issue, optionally replying to a discussion thread | ✏️ |
| [`update_issue_note`](issues.md#update_issue_note) | Modify an existing issue thread note | ✏️ |
| [`list_issue_links`](issues.md#list_issue_links) | List all issue links for a specific issue | 📖 |
| [`list_issue_discussions`](issues.md#list_issue_discussions) | List discussions for an issue | 📖 |
| [`get_issue_link`](issues.md#get_issue_link) | Get a specific issue link | 📖 |
| [`create_issue_link`](issues.md#create_issue_link) | Create an issue link between two issues | ✏️ |
| [`delete_issue_link`](issues.md#delete_issue_link) | Delete an issue link | ✏️ |
| [`create_note`](issues.md#create_note) | Create a new note (comment) to an issue or merge request | ✏️ |
| [`list_issue_emoji_reactions`](issues.md#list_issue_emoji_reactions) | List all emoji reactions on an issue | 📖 |
| [`list_issue_note_emoji_reactions`](issues.md#list_issue_note_emoji_reactions) | List all emoji reactions on an issue note. Pass discussion_id for discussion thread replies. | 📖 |
| [`create_issue_emoji_reaction`](issues.md#create_issue_emoji_reaction) | Add an emoji reaction to an issue (e.g. thumbsup, rocket, eyes) | ✏️ |
| [`delete_issue_emoji_reaction`](issues.md#delete_issue_emoji_reaction) | Remove an emoji reaction from an issue | ✏️ |
| [`create_issue_note_emoji_reaction`](issues.md#create_issue_note_emoji_reaction) | Add an emoji reaction to an issue note. Pass discussion_id for discussion thread replies. | ✏️ |
| [`delete_issue_note_emoji_reaction`](issues.md#delete_issue_note_emoji_reaction) | Remove an emoji reaction from an issue note. Pass discussion_id for discussion thread replies. | ✏️ |

### [Labels](labels.md)

Project label CRUD. *(5 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_labels`](labels.md#list_labels) | List labels for a project | 📖 |
| [`get_label`](labels.md#get_label) | Get a single label from a project | 📖 |
| [`create_label`](labels.md#create_label) | Create a new label in a project | ✏️ |
| [`update_label`](labels.md#update_label) | Update an existing label in a project | ✏️ |
| [`delete_label`](labels.md#delete_label) | Delete a label from a project | ✏️ |

### [Work Items](workitems.md)

Modern unified API for issues, tasks, incidents, and other typed work items — including notes, emoji reactions, and incident timeline events. *(18 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=workitems` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_work_item`](workitems.md#get_work_item) | Get a work item with full details including status, hierarchy, type, and widgets | 📖 |
| [`list_work_items`](workitems.md#list_work_items) | List work items with filters (type, state, search, assignees, labels) | 📖 |
| [`create_work_item`](workitems.md#create_work_item) | Create a work item (issue, task, incident, epic, etc.) with full field support | ✏️ |
| [`update_work_item`](workitems.md#update_work_item) | Update a work item (title, description, labels, assignees, state, parent, custom fields, etc.) | ✏️ |
| [`convert_work_item_type`](workitems.md#convert_work_item_type) | Convert a work item to a different type | ✏️ |
| [`list_work_item_statuses`](workitems.md#list_work_item_statuses) | List available statuses for a work item type (Premium/Ultimate) | 📖 |
| [`list_custom_field_definitions`](workitems.md#list_custom_field_definitions) | List custom field definitions for a work item type | 📖 |
| [`move_work_item`](workitems.md#move_work_item) | Move a work item to a different project | ✏️ |
| [`list_work_item_notes`](workitems.md#list_work_item_notes) | List notes and discussions on a work item | 📖 |
| [`create_work_item_note`](workitems.md#create_work_item_note) | Add a note to a work item (supports Markdown, internal notes, threads) | ✏️ |
| [`list_work_item_emoji_reactions`](workitems.md#list_work_item_emoji_reactions) | List all emoji reactions on a work item | 📖 |
| [`list_work_item_note_emoji_reactions`](workitems.md#list_work_item_note_emoji_reactions) | List all emoji reactions on a work item note (comment, thread, or thread reply) | 📖 |
| [`create_work_item_emoji_reaction`](workitems.md#create_work_item_emoji_reaction) | Add an emoji reaction to a work item (e.g. thumbsup, rocket, eyes) | ✏️ |
| [`delete_work_item_emoji_reaction`](workitems.md#delete_work_item_emoji_reaction) | Remove an emoji reaction from a work item | ✏️ |
| [`create_work_item_note_emoji_reaction`](workitems.md#create_work_item_note_emoji_reaction) | Add an emoji reaction to a work item note (comment, thread, or thread reply) | ✏️ |
| [`delete_work_item_note_emoji_reaction`](workitems.md#delete_work_item_note_emoji_reaction) | Remove an emoji reaction from a work item note (comment, thread, or thread reply) | ✏️ |
| [`get_timeline_events`](workitems.md#get_timeline_events) | List timeline events for an incident | 📖 |
| [`create_timeline_event`](workitems.md#create_timeline_event) | Create a timeline event on an incident | ✏️ |

### [CI Lint](ci.md)

Validate `.gitlab-ci.yml` snippets and project pipeline configs. *(4 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`validate_ci_lint`](ci.md#validate_ci_lint) | Validate provided GitLab CI/CD YAML content for a project | 📖 |
| [`validate_project_ci_lint`](ci.md#validate_project_ci_lint) | Validate an existing .gitlab-ci.yml configuration for a project | 📖 |
| [`list_ci_catalog_resources`](ci.md#list_ci_catalog_resources) | List GitLab CI/CD Catalog resources/components visible to the user | 📖 |
| [`get_ci_catalog_resource`](ci.md#get_ci_catalog_resource) | Get details for a GitLab CI/CD Catalog resource, including versions and components | 📖 |

### [Pipelines, Jobs & Deployments](pipelines.md)

Pipeline + job control (trigger, retry, cancel, play manual jobs, fetch logs/artifacts), and the deployments/environments view. *(19 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=pipelines` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_PIPELINE=true` flag for backward compatibility.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_pipelines`](pipelines.md#list_pipelines) | List pipelines with filtering options | 📖 |
| [`get_pipeline`](pipelines.md#get_pipeline) | Get details of a specific pipeline | 📖 |
| [`list_deployments`](pipelines.md#list_deployments) | List deployments with filtering options | 📖 |
| [`get_deployment`](pipelines.md#get_deployment) | Get details of a specific deployment | 📖 |
| [`list_environments`](pipelines.md#list_environments) | List environments in a project | 📖 |
| [`get_environment`](pipelines.md#get_environment) | Get details of a specific environment | 📖 |
| [`list_pipeline_jobs`](pipelines.md#list_pipeline_jobs) | List all jobs in a specific pipeline | 📖 |
| [`list_pipeline_trigger_jobs`](pipelines.md#list_pipeline_trigger_jobs) | List trigger jobs (bridges) in a pipeline | 📖 |
| [`get_pipeline_job`](pipelines.md#get_pipeline_job) | Get details of a GitLab pipeline job number | 📖 |
| [`get_pipeline_job_output`](pipelines.md#get_pipeline_job_output) | Get the output/trace of a pipeline job with optional pagination | 📖 |
| [`create_pipeline`](pipelines.md#create_pipeline) | Create a new pipeline for a branch or tag | ✏️ |
| [`retry_pipeline`](pipelines.md#retry_pipeline) | Retry a failed or canceled pipeline | ✏️ |
| [`cancel_pipeline`](pipelines.md#cancel_pipeline) | Cancel a running pipeline | ✏️ |
| [`play_pipeline_job`](pipelines.md#play_pipeline_job) | Run a manual pipeline job | ✏️ |
| [`retry_pipeline_job`](pipelines.md#retry_pipeline_job) | Retry a failed or canceled pipeline job | ✏️ |
| [`cancel_pipeline_job`](pipelines.md#cancel_pipeline_job) | Cancel a running pipeline job | ✏️ |
| [`list_job_artifacts`](pipelines.md#list_job_artifacts) | List artifact files in a job's archive | 📖 |
| [`download_job_artifacts`](pipelines.md#download_job_artifacts) | Download job artifact archive (zip) and save to a local path | 📖 |
| [`get_job_artifact_file`](pipelines.md#get_job_artifact_file) | Get content of a single file from a job's artifacts | 📖 |

### [Milestones](milestones.md)

Project and group milestone CRUD plus associated issues/MRs and burndown events. *(17 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=milestones` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_MILESTONE=true` flag for backward compatibility.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_milestones`](milestones.md#list_milestones) | List milestones with filtering options | 📖 |
| [`get_milestone`](milestones.md#get_milestone) | Get details of a specific milestone | 📖 |
| [`create_milestone`](milestones.md#create_milestone) | Create a new milestone | ✏️ |
| [`edit_milestone`](milestones.md#edit_milestone) | Edit an existing milestone | ✏️ |
| [`delete_milestone`](milestones.md#delete_milestone) | Delete a milestone | ✏️ |
| [`get_milestone_issue`](milestones.md#get_milestone_issue) | Get issues associated with a specific milestone | 📖 |
| [`get_milestone_merge_requests`](milestones.md#get_milestone_merge_requests) | Get merge requests associated with a specific milestone | 📖 |
| [`promote_milestone`](milestones.md#promote_milestone) | Promote a milestone to the next stage | ✏️ |
| [`get_milestone_burndown_events`](milestones.md#get_milestone_burndown_events) | Get burndown events for a specific milestone | 📖 |
| [`list_group_milestones`](milestones.md#list_group_milestones) | List group milestones with filtering options | 📖 |
| [`get_group_milestone`](milestones.md#get_group_milestone) | Get details of a specific group milestone | 📖 |
| [`create_group_milestone`](milestones.md#create_group_milestone) | Create a new group milestone | ✏️ |
| [`edit_group_milestone`](milestones.md#edit_group_milestone) | Edit an existing group milestone | ✏️ |
| [`delete_group_milestone`](milestones.md#delete_group_milestone) | Delete a group milestone | ✏️ |
| [`get_group_milestone_issue`](milestones.md#get_group_milestone_issue) | Get issues associated with a specific group milestone | 📖 |
| [`get_group_milestone_merge_requests`](milestones.md#get_group_milestone_merge_requests) | Get merge requests associated with a specific group milestone | 📖 |
| [`get_group_milestone_burndown_events`](milestones.md#get_group_milestone_burndown_events) | Get burndown events for a specific group milestone | 📖 |

### [Wiki](wiki.md)

Project and group wiki page CRUD. Attachment uploads where supported. *(10 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=wiki` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_GITLAB_WIKI=true` flag for backward compatibility.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_wiki_pages`](wiki.md#list_wiki_pages) | List wiki pages in a project | 📖 |
| [`get_wiki_page`](wiki.md#get_wiki_page) | Get details of a specific wiki page | 📖 |
| [`create_wiki_page`](wiki.md#create_wiki_page) | Create a wiki page in a project | ✏️ |
| [`update_wiki_page`](wiki.md#update_wiki_page) | Update a wiki page in a project | ✏️ |
| [`delete_wiki_page`](wiki.md#delete_wiki_page) | Delete a wiki page from a project | ✏️ |
| [`list_group_wiki_pages`](wiki.md#list_group_wiki_pages) | List wiki pages in a group | 📖 |
| [`get_group_wiki_page`](wiki.md#get_group_wiki_page) | Get details of a specific group wiki page | 📖 |
| [`create_group_wiki_page`](wiki.md#create_group_wiki_page) | Create a wiki page in a group | ✏️ |
| [`update_group_wiki_page`](wiki.md#update_group_wiki_page) | Update a wiki page in a group | ✏️ |
| [`delete_group_wiki_page`](wiki.md#delete_group_wiki_page) | Delete a wiki page from a group | ✏️ |

### [Releases](releases.md)

Release lifecycle, release evidence, and asset download. *(7 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=releases` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_releases`](releases.md#list_releases) | List all releases for a project | 📖 |
| [`get_release`](releases.md#get_release) | Get a release by tag name | 📖 |
| [`create_release`](releases.md#create_release) | Create a new release | ✏️ |
| [`update_release`](releases.md#update_release) | Update an existing release | ✏️ |
| [`delete_release`](releases.md#delete_release) | Delete a release (does not delete the tag) | ✏️ |
| [`create_release_evidence`](releases.md#create_release_evidence) | Create release evidence (Premium/Ultimate) | ✏️ |
| [`download_release_asset`](releases.md#download_release_asset) | Download a release asset file by direct asset path | 📖 |

### [Tags](tags.md)

Tag listing, creation, deletion, and signature inspection. *(5 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=tags` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_tags`](tags.md#list_tags) | List repository tags for a project | 📖 |
| [`get_tag`](tags.md#get_tag) | Get a repository tag by name | 📖 |
| [`create_tag`](tags.md#create_tag) | Create a new repository tag | ✏️ |
| [`delete_tag`](tags.md#delete_tag) | Delete a repository tag | ✏️ |
| [`get_tag_signature`](tags.md#get_tag_signature) | Get the X.509 signature of a signed tag (404 if unsigned) | 📖 |

### [Users & Events](users.md)

User lookup, the authenticated user (`whoami`), event streams, and markdown attachment upload/download. *(7 tools)*

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_users`](users.md#get_users) | Get GitLab user details by usernames | 📖 |
| [`get_user`](users.md#get_user) | Get user details by ID | 📖 |
| [`whoami`](users.md#whoami) | Get current authenticated user details | 📖 |
| [`list_events`](users.md#list_events) | List events for the authenticated user (before/after: YYYY-MM-DD) | 📖 |
| [`get_project_events`](users.md#get_project_events) | List events for a project (before/after: YYYY-MM-DD) | 📖 |
| [`upload_markdown`](users.md#upload_markdown) | Upload a file for use in markdown content | ✏️ |
| [`download_attachment`](users.md#download_attachment) | Download an uploaded file from a project (images returned as base64; use local_path to save to disk) | 📖 |

### [Variables](variables.md)

Project and group CI/CD variable CRUD. *(10 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=variables` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_project_variables`](variables.md#list_project_variables) | List CI/CD variables for a project | 📖 |
| [`get_project_variable`](variables.md#get_project_variable) | Get a single CI/CD variable from a project | 📖 |
| [`create_project_variable`](variables.md#create_project_variable) | Create a CI/CD variable for a project | ✏️ |
| [`update_project_variable`](variables.md#update_project_variable) | Update an existing CI/CD variable in a project | ✏️ |
| [`delete_project_variable`](variables.md#delete_project_variable) | Delete a CI/CD variable from a project | ✏️ |
| [`list_group_variables`](variables.md#list_group_variables) | List CI/CD variables for a group | 📖 |
| [`get_group_variable`](variables.md#get_group_variable) | Get a single CI/CD variable from a group | 📖 |
| [`create_group_variable`](variables.md#create_group_variable) | Create a CI/CD variable for a group | ✏️ |
| [`update_group_variable`](variables.md#update_group_variable) | Update an existing CI/CD variable in a group | ✏️ |
| [`delete_group_variable`](variables.md#delete_group_variable) | Delete a CI/CD variable from a group | ✏️ |

### [Webhooks](webhooks.md)

List webhooks configured on projects or groups, and inspect recent webhook events. *(3 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=webhooks` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`list_webhooks`](webhooks.md#list_webhooks) | List webhooks for a project or group | 📖 |
| [`list_webhook_events`](webhooks.md#list_webhook_events) | List recent webhook events (past 7 days) | 📖 |
| [`get_webhook_event`](webhooks.md#get_webhook_event) | Get full details of a specific webhook event | 📖 |

### [Search](search.md)

Code search across all visible projects, a specific project, or a specific group. *(3 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=search` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`search_code`](search.md#search_code) | Search for code across all projects (requires advanced search or Zoekt) | 📖 |
| [`search_project_code`](search.md#search_project_code) | Search for code within a specific project (requires advanced search or Zoekt) | 📖 |
| [`search_group_code`](search.md#search_group_code) | Search for code within a specific group (requires advanced search or Zoekt) | 📖 |

### [Dependency Proxy](dependency-proxy.md)

Inspect and manage the GitLab dependency proxy cache settings, blob storage, and purge operations. *(4 tools)*

> Opt-in. Enable via `GITLAB_TOOLSETS=dependency_proxy` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

| Tool | What it does | R/W |
|---|---|:-:|
| [`get_dependency_proxy_settings`](dependency-proxy.md#get_dependency_proxy_settings) | Get dependency proxy settings for a group | 📖 |
| [`update_dependency_proxy_settings`](dependency-proxy.md#update_dependency_proxy_settings) | Update dependency proxy settings for a group (enable/disable, credentials for authenticated Docker Hub pulls) | ✏️ |
| [`list_dependency_proxy_blobs`](dependency-proxy.md#list_dependency_proxy_blobs) | List cached dependency proxy blobs for a group | 📖 |
| [`purge_dependency_proxy_cache`](dependency-proxy.md#purge_dependency_proxy_cache) | Schedule purge of all cached dependency proxy blobs for a group | ✏️ |

### [Meta & GraphQL](meta.md)

Server diagnostics, tool discovery, and the GraphQL escape hatch. *(2 tools)*

> Mixed availability. `discover_tools` is always exposed (the server re-adds it after every toolset filter). `execute_graphql` is not part of any toolset — enable it explicitly with `GITLAB_TOOLS=execute_graphql`.

| Tool | What it does | R/W |
|---|---|:-:|
| [`execute_graphql`](meta.md#execute_graphql) | Execute a GitLab GraphQL query | 📖 |
| [`discover_tools`](meta.md#discover_tools) | Discover and activate additional tool categories for this session. Available categories: merge_requests, issues, repositories, branches, projects, labels, ci, groups, pipelines, milestones, wiki, releases, tags, users, workitems, webhooks, search, variables, dependency_proxy. Already-active categories are listed in the response. | 📖 |

---

## Argument schemas

Each group page includes a parameter table per tool, generated from
the authoritative Zod schemas in
[`schemas.ts`](https://github.com/zereight/gitlab-mcp/blob/main/schemas.ts).
For runtime schema inspection from a connected MCP client, call the
`discover_tools` tool.