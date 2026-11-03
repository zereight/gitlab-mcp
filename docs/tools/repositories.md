# Projects & Files

Project search/creation/fork plus the Files API for reading and writing repository content without shelling out to git.

!!! note "Feature toggle"
    Opt-in. Prefer `discover_tools` at runtime, or persist with `GITLAB_TOOLSETS=repositories` / `GITLAB_TOOLS=`. Avoid `GITLAB_TOOLSETS=all` (loads ~all schemas into tools/list). 3 of these tools (`search_repositories`, `get_file_contents`, `get_repository_tree`) are already enabled by default via `core`; the toggle applies to the rest.

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

Search for GitLab projects. If the identifier is known, use a typed get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search query |
| `query` | string |  | Search query (alias for 'search') |
| `page` | number |  | Page number (default 1) |
| `per_page` | number |  | Items per page (max 100, default 20) |

### `create_repository`

*✏️ Writes*

Create a new GitLab project.

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

Get contents of a file or directory from a GitLab project.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path (optional; falls back to env) |
| `file_path` | string |  | Path to the file or directory. Takes precedence over 'path' when both are provided |
| `path` | string |  | Alias of file_path |
| `ref` | string |  | Branch/tag/commit to get contents from |

### `push_files`

*✏️ Writes*

Push multiple files in a single commit. Commit several file changes atomically. Each file defaults to action `create`; optional per-file `action` (create/update/delete/move) and `encoding` (text/base64) are additive. `GITLAB_PERMISSION_MODE=modify` rejects `delete` and `move`.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `branch` | string | ✓ | Branch to push to |
| `files` | array<object> | ✓ | Array of files to push. Each entry defaults to action 'create'. Per-file fields: action (create/update/delete/move), encoding (text/base64; omitted uses GITLAB_REPO_FILE_ENCODING), previous_path (required for move). Content is required for create and update; omit content for delete, or for a move that should keep the original file. GITLAB_PERMISSION_MODE=modify rejects delete and move. |
| `commit_message` | string | ✓ | Commit message |

### `create_or_update_file`

*✏️ Writes*

Create or update a file in a GitLab project. Create or update one repository file. Use `push_files` for a multi-file commit. Optional `encoding` (`text` or `base64`) defaults to `GITLAB_REPO_FILE_ENCODING`.

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

Fork a project to your account or specified namespace. Fork an existing project into the current user's namespace or a permitted namespace. Use `search_repositories` or `get_project` to inspect without copying.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `namespace` | string |  | Namespace to fork to (full path) |

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
