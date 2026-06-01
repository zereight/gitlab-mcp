# Branches & Commits

Branch management, commit listing/inspection, file blame, and CI commit-status manipulation.

## Tools in this group

- [`create_branch`](#create_branch) — ✏️ Writes
- [`get_branch`](#get_branch) — 📖 Read-only
- [`list_branches`](#list_branches) — 📖 Read-only
- [`delete_branch`](#delete_branch) — ✏️ Writes
- [`list_commits`](#list_commits) — 📖 Read-only
- [`get_commit`](#get_commit) — 📖 Read-only
- [`get_commit_diff`](#get_commit_diff) — 📖 Read-only
- [`get_file_blame`](#get_file_blame) — 📖 Read-only
- [`list_commit_statuses`](#list_commit_statuses) — 📖 Read-only
- [`create_commit_status`](#create_commit_status) — ✏️ Writes

---

### `create_branch`

*✏️ Writes*

Create a new branch

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch` | string | ✓ | Name for the new branch |
| `ref` | string |  | Source branch/commit for new branch |

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

### `delete_branch`

*✏️ Writes*

Delete branch from project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the branch to delete |

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

### `list_commit_statuses`

*📖 Read-only*

List statuses for a commit

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `sha` | string | ✓ | The commit hash or name of a repository branch or tag |
| `ref` | string |  | Filter statuses by Git ref |
| `stage` | string |  | Filter statuses by build stage |
| `name` | string |  | Filter statuses by status name or context |
| `pipeline_id` | number |  | Filter statuses by pipeline ID |
| `order_by` | enum (`id` \| `pipeline_id`) |  | Field to order statuses by |
| `sort` | enum (`asc` \| `desc`) |  | Sort direction |
| `all` | boolean |  | Return all statuses, not only latest ones |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_commit_status`

*✏️ Writes*

Create or update the status of a commit

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `sha` | string | ✓ | The commit hash to set the status on |
| `state` | enum (`pending` \| `running` \| `success` \| `failed` \| `canceled` \| `skipped`) | ✓ | Commit status state |
| `ref` | string |  | The branch or tag ref |
| `name` | string |  | Status name. GitLab defaults to 'default' when omitted. |
| `context` | string |  | Alias for name. Provide either name or context, not both. |
| `target_url` | string |  | Target URL associated with this status |
| `description` | string |  | Short status description |
| `coverage` | number |  | Total code coverage for this status |
| `pipeline_id` | number |  | Pipeline ID to attach the status to |
