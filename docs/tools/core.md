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

List merge requests (without project_id: user's MRs; with project_id: project MRs)

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

### `get_merge_request`

*📖 Read-only*

Get details of a merge request (mergeRequestIid or branchName required)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |

### `get_merge_request_approval_state`

*📖 Read-only*

Get merge request approval details including approvers

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of the merge request |

### `list_merge_request_changed_files`

*📖 Read-only*

List changed file paths in a merge request without diff content (mergeRequestIid or branchName required)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files. Examples: ["^vendor/", "\.pb\.go$"] |

### `get_merge_request_file_diff`

*📖 Read-only*

Get diffs for specific files from a merge request (mergeRequestIid or branchName required)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `file_paths` | array<string> | ✓ | List of file paths to retrieve diffs for (e.g. ['src/api/users.ts', 'src/repo/user.go']). Call list_merge_request_changed_files first to get the full list of changed paths. |
| `unidiff` | boolean |  | Present diff in the unified diff format. Default is false. |

### `list_merge_request_diffs`

*📖 Read-only*

List merge request diffs with pagination (mergeRequestIid or branchName required)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |
| `unidiff` | boolean |  | Present diffs in the unified diff format. Default is false. Introduced in GitLab 16.5. |

### `get_merge_request_diffs`

*📖 Read-only*

Get the changes/diffs of a merge request (mergeRequestIid or branchName required)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string |  | The IID of a merge request |
| `source_branch` | string |  | Source branch name |
| `view` | enum (`inline` \| `parallel`) |  | Diff view type |
| `excluded_file_patterns` | array<string> |  | Array of regex patterns to exclude files from the diff results. Each pattern is a JavaScript-compatible regular expression that matches file paths to ignore. Examples: ["^vendor/", "^test/mocks/", "\.spec\.ts$", "package-lock\.json"] |

### `mr_discussions`

*📖 Read-only*

List discussion items for a merge request

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_merge_request`

*✏️ Writes*

Create a new merge request

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

### `create_merge_request_thread`

*✏️ Writes*

Create a new thread on a merge request

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

Resolve a thread on a merge request

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `merge_request_iid` | string | ✓ | The IID of a merge request |
| `discussion_id` | string | ✓ | The ID of a thread |
| `resolved` | boolean | ✓ | Whether to resolve the thread |

### `update_merge_request`

*✏️ Writes*

Update a merge request (mergeRequestIid or branchName required)

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

### `list_issues`

*📖 Read-only*

List issues (default: created by current user; use scope='all' for all)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional - if not provided, lists issues across all accessible projects) |
| `assignee_id` | string |  | Return issues assigned to the given user ID (user id, none, or any). Mutually exclusive with assignee_username. |
| `assignee_username` | array<string> |  | Return issues assigned to the given username. Mutually exclusive with assignee_id. |
| `author_id` | string |  | Return issues created by the given user ID. Mutually exclusive with author_username. |
| `author_username` | string |  | Return issues created by the given username. Mutually exclusive with author_id. |
| `confidential` | boolean |  | Filter confidential or public issues |
| `created_after` | string |  | Return issues created after the given time |
| `created_before` | string |  | Return issues created before the given time |
| `due_date` | string |  | Return issues that have the due date |
| `labels` | array<string> |  | Array of label names |
| `milestone` | string |  | Milestone title |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | Filter to a given type of issue. One of issue, incident, test_case or task |
| `iteration_id` | string |  | Return issues assigned to the given iteration ID. None returns issues that do not belong to an iteration. Any returns issues that belong to an iteration.  |
| `scope` | enum (`created_by_me` \| `assigned_to_me` \| `all`) |  | Return issues from a specific scope |
| `search` | string |  | Search for specific terms |
| `state` | enum (`opened` \| `closed` \| `all`) |  | Return issues with a specific state |
| `updated_after` | string |  | Return issues updated after the given time |
| `updated_before` | string |  | Return issues updated before the given time |
| `with_labels_details` | boolean |  | Return more details for each label |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `my_issues`

*📖 Read-only*

List issues assigned to the authenticated user

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

Get details of a specific issue

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |

### `create_issue`

*✏️ Writes*

Create a new issue

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | Issue title |
| `description` | string |  | Issue description |
| `assignee_ids` | array<number> |  | Array of user IDs to assign |
| `labels` | array<string> |  | Array of label names |
| `milestone_id` | string |  | Milestone ID to assign |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | The type of issue. One of issue, incident, test_case or task. |
| `weight` | number |  | Weight of the issue (numeric, typically hours of work) |

### `update_issue`

*✏️ Writes*

Update an issue

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `title` | string |  | The title of the issue |
| `description` | string |  | The description of the issue |
| `assignee_ids` | array<number> |  | Array of user IDs to assign issue to |
| `confidential` | boolean |  | Set the issue to be confidential |
| `discussion_locked` | boolean |  | Flag to lock discussions |
| `due_date` | string |  | Date the issue is due (YYYY-MM-DD) |
| `labels` | array<string> |  | Array of label names |
| `milestone_id` | string |  | Milestone ID to assign |
| `state_event` | enum (`close` \| `reopen`) |  | Update issue state (close/reopen) |
| `weight` | number |  | Weight of the issue (numeric, typically hours of work) |
| `issue_type` | enum (`issue` \| `incident` \| `test_case` \| `task`) |  | The type of issue. One of issue, incident, test_case or task. |

### `create_issue_note`

*✏️ Writes*

Add a note to an issue, optionally replying to a discussion thread

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

List discussions for an issue

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `issue_iid` | string | ✓ | The internal ID of the project issue |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `update_issue_description_patch`

*✏️ Writes*

Apply a patch (search/replace or unified diff) to an issue description. Reduces token usage by allowing small changes without sending the full description. Supports dry_run to preview changes and create_note to summarize updates.

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

Get contents of a file or directory from a GitLab project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional; falls back to env) |
| `file_path` | string |  | Path to the file or directory. Takes precedence over 'path' when both are provided |
| `path` | string |  | Alias of file_path |
| `ref` | string |  | Branch/tag/commit to get contents from |

### `get_repository_tree`

*📖 Read-only*

List files and directories in a repository

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | The ID or URL-encoded path of the project |
| `path` | string |  | The path inside the repository |
| `ref` | string |  | The name of a repository branch or tag. Defaults to the default branch. |
| `recursive` | boolean |  | Boolean value to get a recursive tree |
| `per_page` | number |  | Number of results to show per page |
| `page_token` | string |  | Token for keyset pagination. Use the next_page_token value returned in the previous response to retrieve the next page. |
| `pagination` | string |  | Pagination method. Use 'keyset' for keyset-based pagination (required for repositories with many files). Non-keyset calls keep the legacy array response for backward compatibility; that legacy response shape is deprecated and may be removed in a future major release. Keyset calls return a structured response with items and next_page_token when more pages are available. |

### `search_repositories`

*📖 Read-only*

Search for GitLab projects

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search query |
| `query` | string |  | Search query (alias for 'search') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_branch`

*📖 Read-only*

Get branch details (commit, protection status)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the branch |

### `list_branches`

*📖 Read-only*

List branches in project with search filter

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `search` | string |  | Search term to filter branches by name |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_commits`

*📖 Read-only*

List repository commits with filtering options

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `ref_name` | string |  | The name of a repository branch, tag or revision range, or if not given the default branch |
| `since` | string |  | Only commits after or on this date are returned in ISO 8601 format YYYY-MM-DDTHH:MM:SSZ |
| `until` | string |  | Only commits before or on this date are returned in ISO 8601 format YYYY-MM-DDTHH:MM:SSZ |
| `path` | string |  | The file path |
| `author` | string |  | Search commits by commit author |
| `all` | boolean |  | Retrieve every commit from the repository |
| `with_stats` | boolean |  | Stats about each commit are added to the response |
| `first_parent` | boolean |  | Follow only the first parent commit upon seeing a merge commit |
| `order` | enum (`default` \| `topo`) |  | List commits in order |
| `trailers` | boolean |  | Parse and include Git trailers for every commit |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_commit`

*📖 Read-only*

Get details of a specific commit

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `sha` | string | ✓ | The commit hash or name of a repository branch or tag |
| `stats` | boolean |  | Include commit stats |

### `get_commit_diff`

*📖 Read-only*

Get changes/diffs of a specific commit

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
| `project_id` | string |  | Project ID or complete URL-encoded path to project |
| `file_path` | string | ✓ | The full path of the file to blame, relative to repo root |
| `ref` | string | ✓ | The name of branch, tag or commit (required by GitLab blame API) |
| `range_start` | integer |  | First line of the blame range (inclusive, 1-based). Both range[start] and range[end] must be set together. |
| `range_end` | integer |  | Last line of the blame range (inclusive, 1-based). Both range[start] and range[end] must be set together. |

### `get_project`

*📖 Read-only*

Get details of a specific project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |

### `list_projects`

*📖 Read-only*

List projects accessible by the current user

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search term for projects |
| `search_namespaces` | boolean |  | Needs to be true if search is full path |
| `owned` | boolean |  | Filter for projects owned by current user |
| `membership` | boolean |  | Filter for projects where current user is a member |
| `simple` | boolean |  | Return only limited fields |
| `archived` | boolean |  | Filter for archived projects |
| `visibility` | enum (`public` \| `internal` \| `private`) |  | Filter by project visibility |
| `order_by` | enum (`id` \| `name` \| `path` \| `created_at` \| `updated_at` \| `last_activity_at`) |  | Return projects ordered by field |
| `sort` | enum (`asc` \| `desc`) |  | Return projects sorted in ascending or descending order |
| `with_issues_enabled` | boolean |  | Filter projects with issues feature enabled |
| `with_merge_requests_enabled` | boolean |  | Filter projects with merge requests feature enabled |
| `min_access_level` | number |  | Filter by minimum access level |
| `topic` | string |  | Filter by topic (projects tagged with this topic) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_project_members`

*📖 Read-only*

List members of a GitLab project

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

List labels for a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `with_counts` | boolean |  | Whether to include issue and merge request counts |
| `include_ancestor_groups` | boolean |  | Include ancestor groups |
| `search` | string |  | Keyword to filter labels by |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `whoami`

*📖 Read-only*

Get current authenticated user details

**Parameters**

_No parameters._

### `health_check`

*📖 Read-only*

Verify server status and authentication

**Parameters**

_No parameters._
