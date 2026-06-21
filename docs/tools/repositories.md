# Projects & Files

Project search/creation/fork plus the Files API for reading and writing repository content without shelling out to git.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=repositories` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

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

Search for GitLab projects

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search query |
| `query` | string |  | Search query (alias for 'search') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_repository`

*✏️ Writes*

Create a new GitLab project

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

Get contents of a file or directory from a GitLab project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional; falls back to env) |
| `file_path` | string |  | Path to the file or directory. Takes precedence over 'path' when both are provided |
| `path` | string |  | Alias of file_path |
| `ref` | string |  | Branch/tag/commit to get contents from |

### `push_files`

*✏️ Writes*

Push multiple files in a single commit

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch` | string | ✓ | Branch to push to |
| `files` | array<object> | ✓ | Array of files to push |
| `commit_message` | string | ✓ | Commit message |

### `create_or_update_file`

*✏️ Writes*

Create or update a file in a GitLab project

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

### `fork_repository`

*✏️ Writes*

Fork a project to your account or specified namespace

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `namespace` | string |  | Namespace to fork to (full path) |

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
