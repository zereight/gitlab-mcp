# Merge Requests

MR lifecycle — create, update, merge, approve, plus diff/conflict inspection and the full discussion/note/draft API.

## Tools in this group

- [`merge_merge_request`](#merge_merge_request) — ✏️ Writes
- [`approve_merge_request`](#approve_merge_request) — ✏️ Writes
- [`unapprove_merge_request`](#unapprove_merge_request) — ✏️ Writes
- [`get_merge_request_approval_state`](#get_merge_request_approval_state) — 📖 Read-only
- [`get_branch`](#get_branch) — 📖 Read-only
- [`list_branches`](#list_branches) — 📖 Read-only
- [`get_merge_request_conflicts`](#get_merge_request_conflicts) — 📖 Read-only
- [`list_merge_request_pipelines`](#list_merge_request_pipelines) — 📖 Read-only
- [`get_merge_request`](#get_merge_request) — 📖 Read-only
- [`get_merge_request_diffs`](#get_merge_request_diffs) — 📖 Read-only
- [`list_merge_request_changed_files`](#list_merge_request_changed_files) — 📖 Read-only
- [`list_merge_request_diffs`](#list_merge_request_diffs) — 📖 Read-only
- [`get_merge_request_file_diff`](#get_merge_request_file_diff) — 📖 Read-only
- [`list_merge_request_versions`](#list_merge_request_versions) — 📖 Read-only
- [`get_merge_request_version`](#get_merge_request_version) — 📖 Read-only
- [`update_merge_request`](#update_merge_request) — ✏️ Writes
- [`create_merge_request`](#create_merge_request) — ✏️ Writes
- [`list_merge_requests`](#list_merge_requests) — 📖 Read-only
- [`list_group_merge_requests`](#list_group_merge_requests) — 📖 Read-only
- [`get_branch_diffs`](#get_branch_diffs) — 📖 Read-only
- [`mr_discussions`](#mr_discussions) — 📖 Read-only
- [`create_merge_request_note`](#create_merge_request_note) — ✏️ Writes
- [`update_merge_request_note`](#update_merge_request_note) — ✏️ Writes
- [`delete_merge_request_note`](#delete_merge_request_note) — ✏️ Writes
- [`get_merge_request_note`](#get_merge_request_note) — 📖 Read-only
- [`get_merge_request_notes`](#get_merge_request_notes) — 📖 Read-only
- [`delete_merge_request_discussion_note`](#delete_merge_request_discussion_note) — ✏️ Writes
- [`update_merge_request_discussion_note`](#update_merge_request_discussion_note) — ✏️ Writes
- [`create_merge_request_discussion_note`](#create_merge_request_discussion_note) — ✏️ Writes
- [`get_draft_note`](#get_draft_note) — 📖 Read-only
- [`list_draft_notes`](#list_draft_notes) — 📖 Read-only
- [`create_draft_note`](#create_draft_note) — ✏️ Writes
- [`update_draft_note`](#update_draft_note) — ✏️ Writes
- [`delete_draft_note`](#delete_draft_note) — ✏️ Writes
- [`publish_draft_note`](#publish_draft_note) — ✏️ Writes
- [`bulk_publish_draft_notes`](#bulk_publish_draft_notes) — ✏️ Writes
- [`create_merge_request_thread`](#create_merge_request_thread) — ✏️ Writes
- [`resolve_merge_request_thread`](#resolve_merge_request_thread) — ✏️ Writes
- [`list_merge_request_emoji_reactions`](#list_merge_request_emoji_reactions) — 📖 Read-only
- [`list_merge_request_note_emoji_reactions`](#list_merge_request_note_emoji_reactions) — 📖 Read-only
- [`create_merge_request_emoji_reaction`](#create_merge_request_emoji_reaction) — ✏️ Writes
- [`delete_merge_request_emoji_reaction`](#delete_merge_request_emoji_reaction) — ✏️ Writes
- [`create_merge_request_note_emoji_reaction`](#create_merge_request_note_emoji_reaction) — ✏️ Writes
- [`delete_merge_request_note_emoji_reaction`](#delete_merge_request_note_emoji_reaction) — ✏️ Writes

---

### `merge_merge_request`

*✏️ Writes*

Merge a merge request. Use this only after checking the merge request approval, conflict, and pipeline state; use `approve_merge_request` to approve rather than merge. The operation changes repository state and may squash commits, schedule auto-merge, or delete the source branch, so it requires merge permission and returns GitLab's merge result or a mergeability error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `auto_merge` | boolean |  | If true, the merge request merges when the pipeline succeeds. |
| `merge_commit_message` | string |  | Custom merge commit message |
| `merge_when_pipeline_succeeds` | boolean |  | If true, the merge request merges when the pipeline succeeds. Deprecated in GitLab 17.11. Use `auto_merge` instead. |
| `should_remove_source_branch` | boolean |  | Remove source branch after merge |
| `squash_commit_message` | string |  | Custom squash commit message |
| `squash` | boolean |  | Squash commits into a single commit when merging |

### `approve_merge_request`

*✏️ Writes*

Approve a merge request. Use this to record an approval on an existing merge request; it does not merge the request or change its source branch. The operation changes review state, may require re-authentication or approval permission, and returns the updated approval result or a permission/state error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of the merge request to approve |
| `sha` | string |  | The HEAD of the merge request. Optional, but used to ensure the merge request hasn't changed since you last reviewed it |
| `approval_password` | string |  | Current user's password. Required if 'Require user re-authentication to approve' is enabled in the project settings |

### `unapprove_merge_request`

*✏️ Writes*

Unapprove a merge request. Use this to remove the current user's approval from an existing merge request; use `merge_merge_request` only when you intend to merge. The operation changes review state and requires approval permission, and GitLab returns the updated result or an error when the request or approval is unavailable.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of the merge request to unapprove |

### `get_merge_request_approval_state`

*📖 Read-only*

Get merge request approval details including approvers. Use this to inspect approval rules and approvers before deciding whether a merge request can be merged; use `approve_merge_request` to change approval state. It is read-only and returns the approval-state response, while missing requests, unsupported GitLab versions, and permission failures are reported as errors.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of the merge request |

### `get_branch`

*📖 Read-only*

Get branch details (commit, protection status). Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the branch |

### `list_branches`

*📖 Read-only*

List branches in project with search filter. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `search` | string |  | Search term to filter branches by name |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_merge_request_conflicts`

*📖 Read-only*

Get the conflicts of a merge request. Use this to inspect merge conflicts before attempting `merge_merge_request`; it reports conflicts and does not resolve them. It is read-only, requires access to the project and merge request, and returns GitLab's conflict data or an error when the request cannot be evaluated.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of the merge request |

### `list_merge_request_pipelines`

*📖 Read-only*

List pipelines for a merge request with pagination. Use this to inspect pipelines associated with one merge request; use `list_pipelines` for project-wide pipeline filtering. It is read-only and paginated, requires project access, and returns pipeline records or GitLab errors for invalid identifiers, missing resources, or rate limits.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The internal ID of the merge request |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_merge_request`

*📖 Read-only*

Get details of a merge request (mergeRequestIid or branchName required). Set include_summaries=true for deployment/commit/approval summaries. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `include_summaries` | boolean |  | If true, include deployment_summary, commit_addition_summary and approval_summary (extra API calls, larger response). Default false to reduce token usage. |

### `get_merge_request_diffs`

*📖 Read-only*

Get the changes/diffs of a merge request (mergeRequestIid or branchName required). Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `view` | enum (`inline` \| `parallel`) |  | Diff view type |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files from the diff results. Each pattern is a JavaScript-compatible regular expression that matches file paths to ignore. Examples: ["^vendor/", "^test/mocks/", "\.spec\.ts$", "package-lock\.json"] |

### `list_merge_request_changed_files`

*📖 Read-only*

List changed file paths in a merge request without diff content (mergeRequestIid or branchName required). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files. Examples: ["^vendor/", "\.pb\.go$"] |

### `list_merge_request_diffs`

*📖 Read-only*

List merge request diffs with pagination (mergeRequestIid or branchName required). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |
| `unidiff` | boolean |  | Present diffs in the unified diff format. Default is false. Introduced in GitLab 16.5. |

### `get_merge_request_file_diff`

*📖 Read-only*

Get diffs for specific files from a merge request (mergeRequestIid or branchName required). Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `file_paths` | array<string> | ✓ | List of file paths to retrieve diffs for (e.g. ['src/api/users.ts', 'src/repo/user.go']). Call list_merge_request_changed_files first to get the full list of changed paths. |
| `unidiff` | boolean |  | Present diff in the unified diff format. Default is false. |

### `list_merge_request_versions`

*📖 Read-only*

List all versions of a merge request. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The internal ID of the merge request |

### `get_merge_request_version`

*📖 Read-only*

Get a specific version of a merge request. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The internal ID of the merge request |
| `version_id` | string | ✓ | The ID of the merge request diff version |
| `unidiff` | boolean |  | Present diffs in the unified diff format. Default is false. Introduced in GitLab 16.5. |

### `update_merge_request`

*✏️ Writes*

Update a merge request (mergeRequestIid or branchName required). Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `title` | string |  | The title of the merge request |
| `description` | string |  | The description of the merge request |
| `target_branch` | string |  | The target branch |
| `assignee_ids` | array<number> |  | The ID of the users to assign the MR to |
| `reviewer_ids` | array<number> |  | The ID of the users to assign as reviewers of the MR |
| `labels` | array<string> |  | Labels for the MR |
| `state_event` | enum (`close` \| `reopen`) |  | New state (close/reopen) for the MR |
| `remove_source_branch` | boolean |  | Flag indicating if the source branch should be removed |
| `squash` | boolean |  | Squash commits into a single commit when merging |
| `draft` | boolean |  | Work in progress merge request |
| `milestone_id` | string |  | Milestone ID to assign. Set to 0 to unassign. Null is treated as omitted. |

### `create_merge_request`

*✏️ Writes*

Create a new merge request. Use this to open a new merge request from an existing source branch to a target branch; use `update_merge_request` after it exists. The operation creates remote review state, requires project access, and returns the new merge request or a validation, permission, branch, or duplicate-related error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | Merge request title |
| `description` | string |  | Merge request description |
| `source_branch` | string | ✓ | Branch containing changes |
| `target_branch` | string | ✓ | Branch to merge into |
| `target_project_id` | string |  | Numeric ID of the target project. |
| `assignee_ids` | array<number> |  | The ID of the users to assign the MR to |
| `reviewer_ids` | array<number> |  | The ID of the users to assign as reviewers of the MR |
| `labels` | array<string> |  | Labels for the MR |
| `draft` | boolean |  | Create as draft merge request |
| `allow_collaboration` | boolean |  | Allow commits from upstream members |
| `remove_source_branch` | boolean \| null |  | Flag indicating if a merge request should remove the source branch when merging. |
| `squash` | boolean \| null |  | If true, squash all commits into a single commit on merge. |

### `list_merge_requests`

*📖 Read-only*

List merge requests (without project_id: user's MRs; with project_id: project MRs). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional - if not provided, lists all merge requests the user has access to) |
| `assignee_id` | string |  | Return MRs assigned to the given user ID (integer), 'none', or 'any'. Mutually exclusive with assignee_username. |
| `assignee_username` | string |  | Returns merge requests assigned to the given username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Returns merge requests created by the given user ID (integer). Mutually exclusive with author_username. |
| `author_username` | string |  | Returns merge requests created by the given username. Mutually exclusive with author_id. |
| `reviewer_id` | string |  | Returns merge requests which have the user as a reviewer. Must be an integer, 'none', or 'any'. Mutually exclusive with reviewer_username. |
| `reviewer_username` | string |  | Returns merge requests which have the user as a reviewer by username. Mutually exclusive with reviewer_id. |
| `approved_by_usernames` | array<string> |  | Returns merge requests approved by the given usernames (array). |
| `created_after` | string |  | Return merge requests created after the given time |
| `created_before` | string |  | Return merge requests created before the given time |
| `updated_after` | string |  | Return merge requests updated after the given time |
| `updated_before` | string |  | Return merge requests updated before the given time |
| `labels` | array<string> |  | Array of label names |
| `milestone` | string |  | Milestone title |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | Return merge requests from a specific scope |
| `search` | string |  | Search for specific terms |
| `state` | enum (`opened` \| `closed` \| `locked` \| `merged` \| `all`) |  | Return merge requests with a specific state |
| `order_by` | enum (`created_at` \| `updated_at` \| `priority` \| `label_priority` \| `milestone_due` \| `popularity`) |  | Return merge requests ordered by the given field |
| `sort` | enum (`asc` \| `desc`) |  | Return merge requests sorted in ascending or descending order |
| `target_branch` | string |  | Return merge requests targeting a specific branch |
| `source_branch` | string |  | Return merge requests from a specific source branch |
| `wip` | enum (`yes` \| `no`) |  | Filter merge requests against their wip status |
| `with_labels_details` | boolean |  | Return more details for each label |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_group_merge_requests`

*📖 Read-only*

List merge requests across all projects of a group and its subgroups. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `assignee_id` | string |  | Return MRs assigned to the given user ID (integer), 'none', or 'any'. Mutually exclusive with assignee_username. |
| `assignee_username` | string |  | Returns merge requests assigned to the given username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Returns merge requests created by the given user ID (integer). Mutually exclusive with author_username. |
| `author_username` | string |  | Returns merge requests created by the given username. Mutually exclusive with author_id. |
| `reviewer_id` | string |  | Returns merge requests which have the user as a reviewer. Must be an integer, 'none', or 'any'. Mutually exclusive with reviewer_username. |
| `reviewer_username` | string |  | Returns merge requests which have the user as a reviewer by username. Mutually exclusive with reviewer_id. |
| `approved_by_usernames` | array<string> |  | Returns merge requests approved by the given usernames (array). |
| `created_after` | string |  | Return merge requests created after the given time |
| `created_before` | string |  | Return merge requests created before the given time |
| `updated_after` | string |  | Return merge requests updated after the given time |
| `updated_before` | string |  | Return merge requests updated before the given time |
| `labels` | array<string> |  | Array of label names |
| `milestone` | string |  | Milestone title |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | Return merge requests from a specific scope |
| `search` | string |  | Search for specific terms |
| `state` | enum (`opened` \| `closed` \| `locked` \| `merged` \| `all`) |  | Return merge requests with a specific state |
| `order_by` | enum (`created_at` \| `updated_at` \| `priority` \| `label_priority` \| `milestone_due` \| `popularity`) |  | Return merge requests ordered by the given field |
| `sort` | enum (`asc` \| `desc`) |  | Return merge requests sorted in ascending or descending order |
| `target_branch` | string |  | Return merge requests targeting a specific branch |
| `source_branch` | string |  | Return merge requests from a specific source branch |
| `wip` | enum (`yes` \| `no`) |  | Filter merge requests against their wip status |
| `with_labels_details` | boolean |  | Return more details for each label |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `non_archived` | boolean |  | Return merge requests from non-archived projects only. Defaults to true. |
| `source_project_id` | string |  | Return merge requests with the given source project ID |

### `get_branch_diffs`

*📖 Read-only*

Get diffs between two branches or commits. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `from` | string | ✓ | The base branch or commit SHA to compare from |
| `to` | string | ✓ | The target branch or commit SHA to compare to |
| `straight` | boolean |  | Comparison method: false for '...' (default), true for '--' |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files from the diff results. Each pattern is a JavaScript-compatible regular expression that matches file paths to ignore. Examples: ["^vendor/", "^test/mocks/", "\.spec\.ts$", "package-lock\.json"] |

### `mr_discussions`

*📖 Read-only*

List discussion items for a merge request. Use this to list complete discussion threads for a merge request; use `get_merge_request_notes` when only flat notes are needed. It is read-only and returns threaded discussion items, while invalid merge request identifiers, missing resources, and permission failures are reported as errors.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_merge_request_note`

*✏️ Writes*

Add a new note to a merge request. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `body` | string | ✓ | The content of the note or reply |

### `update_merge_request_note`

*✏️ Writes*

Modify an existing merge request note. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a thread note |
| `body` | string | ✓ | The content of the note or reply |

### `delete_merge_request_note`

*✏️ Writes*

Delete an existing merge request note. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a thread note |

### `get_merge_request_note`

*📖 Read-only*

Get a specific note for a merge request. Use this to fetch one known merge request note by note identifier; use `get_merge_request_notes` for a collection and `mr_discussions` for threaded context. It is read-only and returns the note object or an error for an invalid identifier, missing note, or insufficient permission.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a thread note |

### `get_merge_request_notes`

*📖 Read-only*

List notes for a merge request. Use this to list flat notes on a merge request; use `mr_discussions` when thread structure and resolution state are required. It is read-only and returns note records, while invalid identifiers, missing resources, and pagination or permission errors are reported by GitLab.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `sort` | enum (`asc` \| `desc`) |  | The sort order of the notes |
| `order_by` | enum (`created_at` \| `updated_at`) |  | The field to sort the notes by |
| `per_page` | number |  | Number of items per page |
| `page` | number |  | Page number for pagination |

### `delete_merge_request_discussion_note`

*✏️ Writes*

Delete a discussion note on a merge request. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `discussion_id` | string | ✓ | The ID of a thread |
| `note_id` | string | ✓ | The ID of a thread note |

### `update_merge_request_discussion_note`

*✏️ Writes*

Update a discussion note on a merge request. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `discussion_id` | string |  | The ID of a thread |
| `note_id` | string |  | The ID of a thread note |
| `body` | string |  | The content of the note or reply |
| `resolved` | boolean |  | Resolve or unresolve the note |

### `create_merge_request_discussion_note`

*✏️ Writes*

Add a new discussion note to an existing merge request thread. Use this to reply inside an existing merge request discussion; use `create_merge_request_thread` to start a new thread and `create_merge_request_note` for a top-level note. The operation creates remote review content, requires note permission, and returns the new note or a missing-discussion/position/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `discussion_id` | string | ✓ | The ID of a thread |
| `body` | string | ✓ | The content of the note or reply |
| `created_at` | string |  | Date the note was created at (ISO 8601 format) |

### `get_draft_note`

*📖 Read-only*

Get a single draft note from a merge request. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `draft_note_id` | string | ✓ | The ID of the draft note |

### `list_draft_notes`

*📖 Read-only*

List draft notes for a merge request. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |

### `create_draft_note`

*✏️ Writes*

Create a draft note for a merge request. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `body` | string | ✓ | The content of the draft note |
| `in_reply_to_discussion_id` | string |  | The ID of a discussion the draft note replies to |
| `position` | object |  | Position when creating a diff note |
| `resolve_discussion` | boolean |  | Whether to resolve the discussion when publishing |

### `update_draft_note`

*✏️ Writes*

Update an existing draft note. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `draft_note_id` | string | ✓ | The ID of the draft note |
| `body` | string |  | The content of the draft note |
| `position` | object |  | Position when creating a diff note |
| `resolve_discussion` | boolean |  | Whether to resolve the discussion when publishing |

### `delete_draft_note`

*✏️ Writes*

Delete a draft note. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `draft_note_id` | string | ✓ | The ID of the draft note |

### `publish_draft_note`

*✏️ Writes*

Publish a single draft note. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `draft_note_id` | string | ✓ | The ID of the draft note |

### `bulk_publish_draft_notes`

*✏️ Writes*

Publish all draft notes for a merge request. Optionally sets reviewer_state and posts a summary note (GitLab 19.2+). Can set reviewer_state even with no drafts. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `reviewer_state` | enum (`requested_changes` \| `reviewed`) |  | Set reviewer review state after publishing (GitLab 19.2+). Does not record a formal approval. Works even with no draft notes. |
| `note` | string |  | Summary note body to post on the merge request (GitLab 19.2+) |
| `internal` | boolean |  | If true, the summary note is internal (GitLab 19.2+, default false) |

### `create_merge_request_thread`

*✏️ Writes*

Create a new thread on a merge request. Use this to start a review thread on a merge request; use `create_merge_request_note` for an unthreaded note and `create_merge_request_discussion_note` to reply to an existing thread. The operation creates remote review content, requires note permission, and returns the discussion or a position/permission/validation error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `body` | string | ✓ | The content of the thread |
| `position` | object |  | Position when creating a diff note |
| `created_at` | string |  | Date the thread was created at (ISO 8601 format) |

### `resolve_merge_request_thread`

*✏️ Writes*

Resolve a thread on a merge request. Use this to mark an existing merge request review thread resolved; use `update_merge_request_discussion_note` when the note text itself must change. The operation changes review state, requires permission to resolve discussions, and returns the updated discussion or a missing-thread/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `discussion_id` | string | ✓ | The ID of a thread |
| `resolved` | boolean | ✓ | Whether to resolve the thread |

### `list_merge_request_emoji_reactions`

*📖 Read-only*

List all emoji reactions on a merge request. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |

### `list_merge_request_note_emoji_reactions`

*📖 Read-only*

List all emoji reactions on a merge request note. Pass discussion_id for discussion thread replies. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |

### `create_merge_request_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to a merge request (e.g. thumbsup, rocket, eyes). Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_merge_request_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from a merge request. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `award_id` | string | ✓ | The ID of the emoji reaction to delete |

### `create_merge_request_note_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to a merge request note. Pass discussion_id for discussion thread replies. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_merge_request_note_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from a merge request note. Pass discussion_id for discussion thread replies. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a note (comment or thread reply) |
| `discussion_id` | string |  | The ID of a discussion thread. Required for notes that are discussion replies; omit for top-level notes. |
| `award_id` | string | ✓ | The ID of the emoji reaction to delete |
