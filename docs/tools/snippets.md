# Snippets

Snippet CRUD — list, get (with optional file content), create, update, and delete personal or project snippets.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=snippets` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_snippets`](#list_snippets) — 📖 Read-only
- [`get_snippet`](#get_snippet) — 📖 Read-only
- [`create_snippet`](#create_snippet) — ✏️ Writes
- [`update_snippet`](#update_snippet) — ✏️ Writes
- [`delete_snippet`](#delete_snippet) — ✏️ Writes

---

### `list_snippets`

*📖 Read-only*

List snippets — project snippets when project_id is given, otherwise personal snippets. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit for personal snippets, or the configured project when GITLAB_PROJECT_ID / GITLAB_ALLOWED_PROJECT_IDS is set. |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_snippet`

*📖 Read-only*

Get a snippet's metadata. Set include_content=true to also fetch the raw file content. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit for personal snippets, or the configured project when GITLAB_PROJECT_ID / GITLAB_ALLOWED_PROJECT_IDS is set. |
| `snippet_id` | number | ✓ | The snippet ID |
| `include_content` | boolean |  | Whether to fetch the raw file content (default: false) |
| `ref` | string |  | Branch, tag, or commit to fetch content from. Inferred from the snippet's raw_url when omitted. |

### `create_snippet`

*✏️ Writes*

Create a snippet — project-scoped when project_id is given, otherwise a personal snippet. Supports single-file (file_name + content) or multi-file (files[]). Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit for a personal snippet, or the configured project when GITLAB_PROJECT_ID / GITLAB_ALLOWED_PROJECT_IDS is set. |
| `title` | string | ✓ | Snippet title |
| `file_name` | string |  | File name for a single-file snippet (e.g., 'script.py'). Use together with content. Mutually exclusive with files[]. |
| `content` | string |  | File content for a single-file snippet. Use together with file_name. |
| `files` | array<object> |  | Array of files for a multi-file snippet. Each item needs file_path and content. Mutually exclusive with file_name/content. |
| `description` | string |  | Optional snippet description |
| `visibility` | enum (`private` \| `internal` \| `public`) |  | Snippet visibility (default: private) |

### `update_snippet`

*✏️ Writes*

Update an existing snippet (provide at least one field to change). For multi-file edits — renames, deletions, additions — pass files[] with action (create/update/delete/move) and previous_path. The file_name + content shortcut still works for single-file content replacement.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit for personal snippets, or the configured project when GITLAB_PROJECT_ID / GITLAB_ALLOWED_PROJECT_IDS is set. |
| `snippet_id` | number | ✓ | The snippet ID to update |
| `title` | string |  | New title |
| `file_name` | string |  | File name to update. Provide together with content to replace a single-file snippet's contents. |
| `content` | string |  | New file content (requires file_name) |
| `files` | array<object> |  | Multi-file update actions. Each item has 'action' (create/update/delete/move) plus the relevant path/content fields. Use this for renames (action: 'move' with previous_path), deletions, and additions. Mutually exclusive with file_name/content. |
| `description` | string |  | New description |
| `visibility` | enum (`private` \| `internal` \| `public`) |  | New visibility |

### `delete_snippet`

*✏️ Writes*

Delete a snippet. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Omit for personal snippets, or the configured project when GITLAB_PROJECT_ID / GITLAB_ALLOWED_PROJECT_IDS is set. |
| `snippet_id` | number | ✓ | The snippet ID to delete |
