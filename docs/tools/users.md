# Users & Events

User lookup, the authenticated user (`whoami`), event streams, and markdown attachment upload/download.

## Tools in this group

- [`get_users`](#get_users) — 📖 Read-only
- [`get_user`](#get_user) — 📖 Read-only
- [`whoami`](#whoami) — 📖 Read-only
- [`list_events`](#list_events) — 📖 Read-only
- [`get_project_events`](#get_project_events) — 📖 Read-only
- [`upload_markdown`](#upload_markdown) — ✏️ Writes
- [`download_attachment`](#download_attachment) — 📖 Read-only

---

### `get_users`

*📖 Read-only*

Get GitLab user details by usernames. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `usernames` | array<string> | ✓ | Array of usernames to search for |

### `get_user`

*📖 Read-only*

Get user details by ID. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `user_id` | string | ✓ | The ID of the user |

### `whoami`

*📖 Read-only*

Get current authenticated user details. Use this to identify the authenticated GitLab user; use `get_user` or `get_users` when looking up another user. It is read-only and returns the current user profile, while missing credentials or GitLab permission failures are reported as errors.

**Parameters**

_No parameters._

### `list_events`

*📖 Read-only*

List events for the authenticated user (before/after: YYYY-MM-DD). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `action` | string |  | If defined, returns events with the specified action type |
| `target_type` | enum (`epic` \| `issue` \| `merge_request` \| `milestone` \| `note` \| `project` \| `snippet` \| `user`) |  | If defined, returns events with the specified target type |
| `before` | string |  | If defined, Returns events created before the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use before=2025-08-30 |
| `after` | string |  | If defined, Returns events created after the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use after=2025-08-28 |
| `scope` | string |  | Include all events across a user's projects |
| `sort` | enum (`asc` \| `desc`) |  | Direction to sort the results by creation date. Default: desc |
| `page` | number |  | Returns the specified results page. Default: 1 |
| `per_page` | number |  | Number of results per page. Default: 20 |

### `get_project_events`

*📖 Read-only*

List events for a project (before/after: YYYY-MM-DD). Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `action` | string |  | If defined, returns events with the specified action type |
| `target_type` | enum (`epic` \| `issue` \| `merge_request` \| `milestone` \| `note` \| `project` \| `snippet` \| `user`) |  | If defined, returns events with the specified target type |
| `before` | string |  | If defined, Returns events created before the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use before=2025-08-30 |
| `after` | string |  | If defined, Returns events created after the specified date (YYYY-MM-DD format). To include events on 2025-08-29, use after=2025-08-28 |
| `sort` | enum (`asc` \| `desc`) |  | Direction to sort the results by creation date. Default: desc |
| `page` | number |  | Returns the specified results page. Default: 1 |
| `per_page` | number |  | Number of results per page. Default: 20 |

### `upload_markdown`

*✏️ Writes*

Upload a file for use in markdown content. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path of the project |
| `file_path` | string | ✓ | Path to the file to upload |

### `download_attachment`

*📖 Read-only*

Download an uploaded file from a project (images returned as base64; use local_path to save to disk). Use this to retrieve a previously uploaded project attachment; remote mode returns inline base64 for images or a download URL, while local mode can save to a path. It is read-only with respect to GitLab, requires project access, and returns the file content or an attachment/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path of the project |
| `secret` | string | ✓ | The 32-character secret of the upload |
| `filename` | string | ✓ | The filename of the upload |
| `local_path` | string |  | Local path to save the file (optional, defaults to current directory) |
