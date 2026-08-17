# Branches & Commits

Branch management, commit listing/inspection, file blame, and CI commit-status manipulation.

## Tools in this group

- [`create_branch`](#create_branch) — ✏️ Writes
- [`get_branch`](#get_branch) — 📖 Read-only
- [`list_branches`](#list_branches) — 📖 Read-only
- [`delete_branch`](#delete_branch) — ✏️ Writes
- [`list_protected_branches`](#list_protected_branches) — 📖 Read-only
- [`get_protected_branch`](#get_protected_branch) — 📖 Read-only
- [`protect_branch`](#protect_branch) — ✏️ Writes
- [`unprotect_branch`](#unprotect_branch) — ✏️ Writes
- [`update_default_branch`](#update_default_branch) — ✏️ Writes
- [`list_commits`](#list_commits) — 📖 Read-only
- [`get_commit`](#get_commit) — 📖 Read-only
- [`get_commit_diff`](#get_commit_diff) — 📖 Read-only
- [`get_file_blame`](#get_file_blame) — 📖 Read-only
- [`list_commit_statuses`](#list_commit_statuses) — 📖 Read-only
- [`create_commit_status`](#create_commit_status) — ✏️ Writes

---

### `create_branch`

*✏️ Writes*

Create a new branch. Use this to create a branch from a branch, tag, or commit; use `get_branch` or `list_branches` to inspect branches and `protect_branch` to configure protection afterward. The operation changes remote repository state, requires branch-creation permission, and returns the new branch or a validation, missing-ref, protected-project, or already-exists error. `project_id` accepts a numeric ID or URL-encoded path, `branch` is the new name, and `ref` selects its starting revision.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch` | string | ✓ | Name for the new branch |
| `ref` | string |  | Source branch/commit for new branch |

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

### `delete_branch`

*✏️ Writes*

Delete branch from project. Use this only after confirming the branch name and intended data loss; use `get_branch` or `list_branches` before deletion and never use it to remove branch protection. The operation permanently removes a remote branch, requires branch-delete permission, and returns the deletion result or a protected-branch, missing-resource, or permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the branch to delete |

### `list_protected_branches`

*📖 Read-only*

List protected branches in a project, supports search filter. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `search` | string |  | Search term to filter protected branches by name |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_protected_branch`

*📖 Read-only*

Get details of a single protected branch (access levels, force push settings). Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the protected branch |

### `protect_branch`

*✏️ Writes*

Protect a repository branch (set push/merge/unprotect access levels). Use this to create or update protection rules for a branch or wildcard; use `get_protected_branch` to inspect existing rules first. The operation changes who may push, merge, or unprotect, may enable force-push or code-owner settings, requires maintainer-level permission, and returns the protection rule or a validation/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Branch name or wildcard pattern to protect |
| `name` | string |  | Deprecated alias for branch_name; prefer branch_name for consistency |
| `push_access_level` | integer |  | Access level for pushing (0=No access, 30=Developer, 40=Maintainer, 60=Admin). GitLab default applies when omitted. |
| `merge_access_level` | integer |  | Access level for merging (0=No access, 30=Developer, 40=Maintainer, 60=Admin). GitLab default applies when omitted. |
| `unprotect_access_level` | integer |  | Access level for unprotecting (0=No access, 30=Developer, 40=Maintainer, 60=Admin). GitLab default applies when omitted. |
| `allow_force_push` | boolean |  | Allow force push to the protected branch. Default: false |
| `code_owner_approval_required` | boolean |  | Require code owner approval before merging (PREMIUM). Default: false |

### `unprotect_branch`

*✏️ Writes*

Remove protection from a previously protected branch. Use this to remove protection from an existing branch; use `protect_branch` to change access levels without removing the rule. The operation changes repository security controls, requires permission to manage protected branches, and returns the result or an error when the branch is missing or policy forbids the change.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch_name` | string | ✓ | Name of the protected branch to unprotect |

### `update_default_branch`

*✏️ Writes*

Change the default branch of a project. Use this to change which branch GitLab treats as the project's default; use `create_branch` to create a branch rather than changing project defaults. The operation changes project settings and may affect clone, merge request, and CI defaults, requires project-maintainer permission, and returns the updated project or a validation/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `default_branch` | string | ✓ | The new default branch name for the project |

### `list_commits`

*📖 Read-only*

List repository commits with filtering options. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get details of a specific commit. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `sha` | string | ✓ | The commit hash or name of a repository branch or tag |
| `stats` | boolean |  | Include commit stats |

### `get_commit_diff`

*📖 Read-only*

Get changes/diffs of a specific commit. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

List statuses for a commit. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Create or update the status of a commit. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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
