# Projects & Files

Project search/creation/fork plus the Files API for reading and writing repository content without shelling out to git.

## Tools in this group

- [`search_repositories`](#search_repositories) — 📖 Read-only
- [`create_repository`](#create_repository) — ✏️ Writes
- [`get_file_contents`](#get_file_contents) — 📖 Read-only
- [`push_files`](#push_files) — ✏️ Writes
- [`create_or_update_file`](#create_or_update_file) — ✏️ Writes
- [`fork_repository`](#fork_repository) — ✏️ Writes
- [`get_repository_tree`](#get_repository_tree) — 📖 Read-only

---

### `search_repositories`

*📖 Read-only*

Search for GitLab projects. Use this to discover matching content; choose a typed get or list tool when the target identifier is already known. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search query |
| `query` | string |  | Search query (alias for 'search') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_repository`

*✏️ Writes*

Create a new GitLab project. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `name` | string | ✓ | Repository name |
| `namespace_id` | integer |  | Group namespace ID to create the project in. Omit to use the current user's namespace. |
| `description` | string |  | Repository description |
| `visibility` | enum (`private` \| `internal` \| `public`) |  | Repository visibility level |
| `initialize_with_readme` | boolean |  | Initialize with README.md |

### `get_file_contents`

*📖 Read-only*

Get contents of a file or directory from a GitLab project. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional; falls back to env) |
| `file_path` | string |  | Path to the file or directory. Takes precedence over 'path' when both are provided |
| `path` | string |  | Alias of file_path |
| `ref` | string |  | Branch/tag/commit to get contents from |

### `push_files`

*✏️ Writes*

Push multiple files in a single commit. Use this to commit several file changes atomically; use `create_or_update_file` when only one path is involved. Each file defaults to action `create`; optional per-file `action` (create/update/delete/move) and `encoding` (text/base64) are additive. `GITLAB_PERMISSION_MODE=modify` rejects `delete` and `move`. The operation writes repository history on the selected branch, requires repository write permission, and returns the commit result or a validation, conflict, or protected-branch error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch` | string | ✓ | Branch to push to |
| `files` | array<object> | ✓ | Array of files to push. Each entry defaults to action 'create'. Per-file fields: action (create/update/delete/move), encoding (text/base64; omitted uses GITLAB_REPO_FILE_ENCODING), previous_path (required for move). Content is required for create and update; omit content for delete, or for a move that should keep the original file. GITLAB_PERMISSION_MODE=modify rejects delete and move. |
| `commit_message` | string | ✓ | Commit message |

### `create_or_update_file`

*✏️ Writes*

Create or update a file in a GitLab project. Use this for a single repository file when you know whether the target path is new or already exists; use `push_files` for a multi-file commit. Optional `encoding` (`text` or `base64`) defaults to `GITLAB_REPO_FILE_ENCODING` so existing callers stay unchanged. The operation creates or updates remote content in a commit, requires repository write permission, and returns the commit result or a conflict/validation error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `file_path` | string | ✓ | Path where to create/update the file |
| `content` | string | ✓ | Content of the file |
| `commit_message` | string | ✓ | Commit message |
| `branch` | string | ✓ | Branch to create/update the file in |
| `previous_path` | string |  | Path of the file to move/rename |
| `last_commit_id` | string |  | Last known file commit ID |
| `commit_id` | string |  | Current file commit ID (for update operations) |
| `encoding` | enum (`text` \| `base64`) |  | Content encoding. Use 'base64' for binary files (content must already be base64-encoded). When omitted, GITLAB_REPO_FILE_ENCODING applies. |

### `fork_repository`

*✏️ Writes*

Fork a project to your account or specified namespace. Use this to create a copy of an existing project in the current user's namespace or a permitted namespace; use `search_repositories` or `get_project` to inspect projects without copying them. The operation creates a new project, requires fork permission, and returns the forked project or a namespace/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `namespace` | string |  | Namespace to fork to (full path) |

### `get_repository_tree`

*📖 Read-only*

List files and directories in a repository. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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
