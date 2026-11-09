# Core

Lean default starter set for common MR, issue, repository, branch, project, label, and identity workflows.

## Tools in this group

- [`list_merge_requests`](#list_merge_requests) — 📖 Read-only
- [`get_merge_request`](#get_merge_request) — 📖 Read-only
- [`get_merge_request_approval_state`](#get_merge_request_approval_state) — 📖 Read-only
- [`list_merge_request_changed_files`](#list_merge_request_changed_files) — 📖 Read-only
- [`get_merge_request_file_diff`](#get_merge_request_file_diff) — 📖 Read-only
- [`list_merge_request_diffs`](#list_merge_request_diffs) — 📖 Read-only
- [`get_merge_request_diffs`](#get_merge_request_diffs) — 📖 Read-only
- [`mr_discussions`](#mr_discussions) — 📖 Read-only
- [`get_merge_request_discussion`](#get_merge_request_discussion) — 📖 Read-only
- [`get_merge_request_note`](#get_merge_request_note) — 📖 Read-only
- [`get_merge_request_notes`](#get_merge_request_notes) — 📖 Read-only
- [`create_merge_request`](#create_merge_request) — ✏️ Writes
- [`create_merge_request_thread`](#create_merge_request_thread) — ✏️ Writes
- [`resolve_merge_request_thread`](#resolve_merge_request_thread) — ✏️ Writes
- [`update_merge_request`](#update_merge_request) — ✏️ Writes
- [`list_issues`](#list_issues) — 📖 Read-only
- [`my_issues`](#my_issues) — 📖 Read-only
- [`get_issue`](#get_issue) — 📖 Read-only
- [`create_issue`](#create_issue) — ✏️ Writes
- [`update_issue`](#update_issue) — ✏️ Writes
- [`create_issue_note`](#create_issue_note) — ✏️ Writes
- [`list_issue_discussions`](#list_issue_discussions) — 📖 Read-only
- [`update_issue_description_patch`](#update_issue_description_patch) — ✏️ Writes
- [`get_file_contents`](#get_file_contents) — 📖 Read-only
- [`get_repository_tree`](#get_repository_tree) — 📖 Read-only
- [`search_repositories`](#search_repositories) — 📖 Read-only
- [`get_branch`](#get_branch) — 📖 Read-only
- [`list_branches`](#list_branches) — 📖 Read-only
- [`list_commits`](#list_commits) — 📖 Read-only
- [`get_commit`](#get_commit) — 📖 Read-only
- [`get_commit_diff`](#get_commit_diff) — 📖 Read-only
- [`get_file_blame`](#get_file_blame) — 📖 Read-only
- [`get_project`](#get_project) — 📖 Read-only
- [`list_projects`](#list_projects) — 📖 Read-only
- [`list_project_members`](#list_project_members) — 📖 Read-only
- [`list_labels`](#list_labels) — 📖 Read-only
- [`whoami`](#whoami) — 📖 Read-only
- [`health_check`](#health_check) — 📖 Read-only

---

### `list_merge_requests`

*📖 Read-only*

List merge requests (without project_id: user's MRs; with project_id: project MRs). For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit to list the user's accessible MRs. |
| `assignee_id` | string |  | User ID, none, or any. Mutually exclusive with assignee_username. |
| `assignee_username` | string |  | Username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Author user ID. Mutually exclusive with author_username. |
| `author_username` | string |  | Author username. Mutually exclusive with author_id. |
| `reviewer_id` | string |  | Reviewer user ID, none, or any. Mutually exclusive with reviewer_username. |
| `reviewer_username` | string |  | Reviewer username. Mutually exclusive with reviewer_id. |
| `approved_by_usernames` | array<string> |  | Approved by these usernames |
| `created_after` | string |  | Created after |
| `created_before` | string |  | Created before |
| `updated_after` | string |  | Updated after |
| `updated_before` | string |  | Updated before |
| `labels` | array<string> |  | Label names |
| `milestone` | string |  | Milestone title |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | MR scope |
| `search` | string |  | Search terms |
| `state` | enum (`opened` \| `closed` \| `locked` \| `merged` \| `all`) |  | MR state |
| `order_by` | enum (`created_at` \| `updated_at` \| `priority` \| `label_priority` \| `milestone_due` \| `popularity`) |  | Sort field |
| `sort` | enum (`asc` \| `desc`) |  | asc or desc |
| `target_branch` | string |  | Target branch |
| `source_branch` | string |  | Source branch |
| `wip` | enum (`yes` \| `no`) |  | WIP filter |
| `with_labels_details` | boolean |  | Include label details |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `get_merge_request`

*📖 Read-only*

Get details of a merge request (merge_request_iid or source_branch required). Set include_summaries=true for deployment/commit/approval summaries. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `merge_request_iid` | string |  | Merge request IID |
| `source_branch` | string |  | Source branch name |
| `include_summaries` | boolean |  | If true, include deployment, commit, and approval summaries (extra API calls). Default false. |

### `get_merge_request_approval_state`

*📖 Read-only*

Get merge request approval details including approvers. Inspect approval rules and approvers before merging. Use `approve_merge_request` to change approval state.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of the merge request |

### `list_merge_request_changed_files`

*📖 Read-only*

List changed file paths in a merge request without diff content (merge_request_iid or source_branch required).

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `merge_request_iid` | string |  | Merge request IID |
| `source_branch` | string |  | Source branch name |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files. Examples: ["^vendor/", "\.pb\.go$"] |

### `get_merge_request_file_diff`

*📖 Read-only*

Get diffs for specific files from a merge request (merge_request_iid or source_branch required).

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `merge_request_iid` | string |  | Merge request IID |
| `source_branch` | string |  | Source branch name |
| `file_paths` | array<string> | ✓ | List of file paths to retrieve diffs for (e.g. ['src/api/users.ts', 'src/repo/user.go']). Call list_merge_request_changed_files first to get the full list of changed paths. |
| `unidiff` | boolean |  | Present diff in the unified diff format. Default is false. |

### `list_merge_request_diffs`

*📖 Read-only*

List merge request diffs with pagination (merge_request_iid or source_branch required). For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `merge_request_iid` | string |  | Merge request IID |
| `source_branch` | string |  | Source branch name |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |
| `unidiff` | boolean |  | Present diffs in the unified diff format. Default is false. Introduced in GitLab 16.5. |

### `get_merge_request_diffs`

*📖 Read-only*

Get the changes/diffs of a merge request (merge_request_iid or source_branch required). To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `merge_request_iid` | string |  | Merge request IID |
| `source_branch` | string |  | Source branch name |
| `view` | enum (`inline` \| `parallel`) |  | Diff view type |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files from the diff results. Each pattern is a JavaScript-compatible regular expression that matches file paths to ignore. Examples: ["^vendor/", "^test/mocks/", "\.spec\.ts$", "package-lock\.json"] |

### `mr_discussions`

*📖 Read-only*

List discussion items for a merge request. List complete discussion threads. Use `get_merge_request_notes` for flat notes.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `get_merge_request_discussion`

*📖 Read-only*

Get a single discussion item for a merge request. Fetch one discussion by id. Use `mr_discussions` for a collection and `get_merge_request_note` for a flat note.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `discussion_id` | string | ✓ | The ID of a thread |

### `get_merge_request_note`

*📖 Read-only*

Get a specific note for a merge request. Fetch one note by id. Use `get_merge_request_notes` for a collection and `mr_discussions` for threads.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `note_id` | string | ✓ | The ID of a thread note |

### `get_merge_request_notes`

*📖 Read-only*

List notes for a merge request. List flat notes. Use `mr_discussions` when thread structure and resolution state are required.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `sort` | enum (`asc` \| `desc`) |  | The sort order of the notes |
| `order_by` | enum (`created_at` \| `updated_at`) |  | The field to sort the notes by |
| `per_page` | number |  | Number of items per page |
| `page` | number |  | Page number for pagination |

### `create_merge_request`

*✏️ Writes*

Create a new merge request. Open a merge request from an existing source branch to a target. Use `update_merge_request` after it exists.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | Merge request title |
| `description` | string |  | Merge request description |
| `source_branch` | string | ✓ | Source branch |
| `target_branch` | string | ✓ | Target branch |
| `target_project_id` | string |  | Target project numeric ID |
| `assignee_ids` | array<number> |  | Assignee user IDs |
| `reviewer_ids` | array<number> |  | Reviewer user IDs |
| `labels` | array<string> |  | MR labels |
| `draft` | boolean |  | Create as draft |
| `allow_collaboration` | boolean |  | Allow eligible upstream members to push to the fork source branch |
| `remove_source_branch` | boolean \| null |  | Remove source branch on merge |
| `squash` | boolean \| null |  | Squash commits on merge |

### `create_merge_request_thread`

*✏️ Writes*

Create a new thread on a merge request. Start a review thread. Use `create_merge_request_note` for an unthreaded note and `create_merge_request_discussion_note` to reply.

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

Resolve a thread on a merge request. Mark an existing review thread resolved. Use `update_merge_request_discussion_note` to change note text.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `discussion_id` | string | ✓ | The ID of a thread |
| `resolved` | boolean | ✓ | Whether to resolve the thread |

### `update_merge_request`

*✏️ Writes*

Update a merge request (merge_request_iid or source_branch required). Use the create tool for new resources and a note tool for comments.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `merge_request_iid` | string |  | Merge request IID |
| `source_branch` | string |  | Source branch name |
| `title` | string |  | MR title |
| `description` | string |  | MR description |
| `target_branch` | string |  | Target branch |
| `assignee_ids` | array<number> |  | Assignee user IDs |
| `reviewer_ids` | array<number> |  | Reviewer user IDs |
| `labels` | array<string> |  | MR labels |
| `state_event` | enum (`close` \| `reopen`) |  | close or reopen |
| `remove_source_branch` | boolean |  | Remove source branch on merge |
| `squash` | boolean |  | Squash commits on merge |
| `draft` | boolean |  | Draft / WIP |
| `milestone_id` | string |  | Milestone ID. 0 unassigns. Null is omitted. |

### `list_issues`

*📖 Read-only*

List issues (default: created by current user; use scope='all' for all). Use this for issue management. Optional `project_id`. Use `get_issue` when the iid is known and `my_issues` for assignments.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit to list issues across accessible projects. |
| `assignee_id` | string |  | User ID, none, or any. Mutually exclusive with assignee_username. |
| `assignee_username` | array<string> |  | Username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Author user ID. Mutually exclusive with author_username. |
| `author_username` | string |  | Author username. Mutually exclusive with author_id. |
| `confidential` | boolean |  | Confidential or public |
| `created_after` | string |  | Created after |
| `created_before` | string |  | Created before |
| `due_date` | string |  | Due date |
| `labels` | array<string> |  | Label names |
| `milestone` | string |  | Exact milestone title, not an ID. For a milestone ID, use get_milestone_issue or get_group_milestone_issue (milestones toolset). |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | issue, incident, test_case, or task |
| `iteration_id` | string |  | Iteration ID, none (no iteration), or any (has an iteration). |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | Issue scope |
| `search` | string |  | Search terms |
| `state` | enum (`opened` \| `closed` \| `all`) |  | Issue state |
| `updated_after` | string |  | Updated after |
| `updated_before` | string |  | Updated before |
| `with_labels_details` | boolean |  | Include label details |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `my_issues`

*📖 Read-only*

List issues assigned to the authenticated user. Use this for issue management. Use `list_issues` for project-wide listing and `get_issue` for one issue. Requires classic read_user or fine-grained User:Read.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional to search across all accessible projects) |
| `state` | enum (`opened` \| `closed` \| `all`) |  | Return issues with a specific state (default: opened) |
| `labels` | array<string> |  | Array of label names to filter by |
| `milestone` | string |  | Milestone title to filter by |
| `search` | string |  | Search for specific terms in title and description |
| `created_after` | string |  | Return issues created after the given time (ISO 8601) |
| `created_before` | string |  | Return issues created before the given time (ISO 8601) |
| `updated_after` | string |  | Return issues updated after the given time (ISO 8601) |
| `updated_before` | string |  | Return issues updated before the given time (ISO 8601) |
| `per_page` | number |  | Number of items per page (default: 20, max: 100) |
| `page` | number |  | Page number for pagination (default: 1) |

### `get_issue`

*📖 Read-only*

Get one issue. Slim nested milestone by default; full_response=true for the complete milestone. Use this for issue management. Use `list_issues` or `my_issues` to discover issues first.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | Issue IID |
| `full_response` | boolean |  | If true, include the complete milestone (including description). Default is slim (id, iid, title, state, web_url). |

### `create_issue`

*✏️ Writes*

Create a new issue. Open a new issue. Use `update_issue` for an existing issue and `create_issue_note` for discussion.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | Issue title |
| `description` | string |  | Issue description |
| `assignee_ids` | array<number> |  | Assignee user IDs |
| `labels` | array<string> |  | Label names |
| `milestone_id` | string |  | Milestone ID |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | issue, incident, test_case, or task |
| `weight` | number |  | Issue weight |

### `update_issue`

*✏️ Writes*

Update an issue. Slim confirmation by default; full_response=true for the complete object. Change fields on an existing issue. Use `update_issue_description_patch` for a targeted description edit and `create_issue_note` for discussion.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | Issue IID |
| `title` | string |  | Issue title |
| `description` | string |  | Issue description |
| `assignee_ids` | array<number> |  | Assignee user IDs |
| `confidential` | boolean |  | Confidential |
| `discussion_locked` | boolean |  | Lock discussions |
| `due_date` | string |  | Due date (YYYY-MM-DD) |
| `labels` | array<string> |  | Label names |
| `milestone_id` | string |  | Milestone ID |
| `state_event` | enum (`close` \| `reopen`) |  | close or reopen |
| `weight` | number |  | Issue weight |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | issue, incident, test_case, or task |
| `full_response` | boolean |  | If true, return the complete updated issue. Default is slim (iid, title, state, web_url, updated_at). |

### `create_issue_note`

*✏️ Writes*

Add a note to an issue, optionally replying to a discussion thread. Add a note to an existing issue, optionally as a reply. Use `update_issue` for issue fields.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `issue_iid` | string | ✓ | The IID of an issue |
| `discussion_id` | string |  | The ID of a thread. If provided, replies to that thread; otherwise creates a top-level note |
| `body` | string | ✓ | The content of the note or reply |
| `created_at` | string |  | Date the note was created at (ISO 8601 format) |

### `list_issue_discussions`

*📖 Read-only*

List discussions for an issue. List threaded discussions for an issue. Use `list_issues` or `get_issue` for issue records.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `update_issue_description_patch`

*✏️ Writes*

Patch an issue description (search/replace or unified diff) without resending the full body. dry_run previews; create_note summarizes.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `patch_type` | enum (`search_replace` \| `unified_diff`) | ✓ | Type of patch format to apply |
| `patch` | string | ✓ | The patch content to apply to the issue description |
| `dry_run` | boolean |  | If true, preview changes without updating the issue |
| `create_note` | boolean |  | If true, add a note summarizing the change after update |
| `allow_multiple` | boolean |  | For search_replace: allow multiple matches to all be replaced (default: false — fail on duplicate) |

### `get_file_contents`

*📖 Read-only*

Get contents of a file or directory from a GitLab project.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional; falls back to env) |
| `file_path` | string |  | Path to the file or directory. Takes precedence over 'path' when both are provided |
| `path` | string |  | Alias of file_path |
| `ref` | string |  | Branch/tag/commit to get contents from |

### `get_repository_tree`

*📖 Read-only*

List files and directories in a repository.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `path` | string |  | Path inside the repository |
| `ref` | string |  | Branch or tag. Defaults to the default branch. |
| `recursive` | boolean |  | Recursive tree |
| `per_page` | number |  | Items per page |
| `page` | integer |  | Offset page number from 1 (items + next_page) |
| `page_token` | string |  | Keyset token from the previous next_page_token |
| `pagination` | string |  | Use keyset for large trees (items + next_page_token). Omit both page and pagination for the legacy array (deprecated). |

### `search_repositories`

*📖 Read-only*

Search for GitLab projects. If the identifier is known, use a typed get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search query |
| `query` | string |  | Search query (alias for 'search') |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `get_branch`

*📖 Read-only*

Get branch details (commit, protection status). To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the branch |

### `list_branches`

*📖 Read-only*

List branches in project with search filter. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `search` | string |  | Search term to filter branches by name |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `list_commits`

*📖 Read-only*

List repository commits with filtering options. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `ref_name` | string |  | Branch, tag, or revision range. Default: default branch. |
| `since` | string |  | Commits on or after this ISO 8601 datetime |
| `until` | string |  | Commits on or before this ISO 8601 datetime |
| `path` | string |  | File path |
| `author` | string |  | Commit author |
| `all` | boolean |  | Every commit in the repository |
| `with_stats` | boolean |  | Include per-commit stats |
| `first_parent` | boolean |  | Follow only the first parent of merges |
| `order` | enum (`default` \| `topo`) |  | default or topo |
| `trailers` | boolean |  | Include Git trailers |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `get_commit`

*📖 Read-only*

Get details of a specific commit. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `sha` | string | ✓ | The commit hash or name of a repository branch or tag |
| `stats` | boolean |  | Include commit stats |

### `get_commit_diff`

*📖 Read-only*

Get changes/diffs of a specific commit. Return the file diffs for one commit. Use `get_commit` for metadata without the patch.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `sha` | string | ✓ | The commit hash or name of a repository branch or tag |
| `full_diff` | boolean |  | Whether to return the full diff or only first page (default: false) |

### `get_file_blame`

*📖 Read-only*

Get git blame for a file at a given ref. Each entry maps a contiguous range of source lines to the commit that last changed them (id, author, authored_date, message). Use range_start/range_end to limit blame to specific lines.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `file_path` | string | ✓ | The full path of the file to blame, relative to repo root |
| `ref` | string | ✓ | The name of branch, tag or commit (required by GitLab blame API) |
| `range_start` | integer |  | First line of the blame range (inclusive, 1-based). Both range[start] and range[end] must be set together. |
| `range_end` | integer |  | Last line of the blame range (inclusive, 1-based). Both range[start] and range[end] must be set together. |

### `get_project`

*📖 Read-only*

Get details of a specific project. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |

### `list_projects`

*📖 Read-only*

List projects accessible by the current user. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search term |
| `search_namespaces` | boolean |  | Set true when search is a full path |
| `owned` | boolean |  | Owned by current user |
| `membership` | boolean |  | Current user is a member |
| `simple` | boolean |  | Limited fields only |
| `archived` | boolean |  | Archived projects |
| `visibility` | enum (`public` \| `internal` \| `private`) |  | public, internal, or private |
| `order_by` | enum (`id` \| `name` \| `path` \| `created_at` \| `updated_at` \| `last_activity_at`) |  | Sort field |
| `sort` | enum (`asc` \| `desc`) |  | asc or desc |
| `with_issues_enabled` | boolean |  | Issues enabled |
| `with_merge_requests_enabled` | boolean |  | Merge requests enabled |
| `min_access_level` | number |  | Minimum access level |
| `topic` | string |  | Topic tag |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `list_project_members`

*📖 Read-only*

List members of a GitLab project. Search project members by name or username. Use `list_group_members` for a group.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `query` | string |  | Search for members by name or username |
| `user_ids` | array<number> |  | Filter by user IDs |
| `skip_users` | array<number> |  | User IDs to exclude |
| `include_inheritance` | boolean |  | Include inherited members. Defaults to false. |
| `per_page` | number |  | Number of items per page (default: 20, max: 100) |
| `page` | number |  | Page number for pagination (default: 1) |

### `list_labels`

*📖 Read-only*

List labels for a project. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `with_counts` | boolean |  | Whether to include issue and merge request counts |
| `include_ancestor_groups` | boolean |  | Include ancestor groups |
| `search` | string |  | Keyword to filter labels by |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `whoami`

*📖 Read-only*

Get current authenticated user details. Requires classic read_user or fine-grained User:Read. Use `get_user` or `get_users` to look up another user.

**Parameters**

_No parameters._

### `health_check`

*📖 Read-only*

Check auth and versions. Always includes mcp_server_version. When authenticated, also GitLab version, revision, and enterprise from GET /api/v4/version. Version lookup failures omit those fields instead of failing.

**Parameters**

_No parameters._
