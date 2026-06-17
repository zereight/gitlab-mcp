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

Get GitLab user details by usernames

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `usernames` | array<string> | ✓ | Array of usernames to search for |

### `get_user`

*📖 Read-only*

Get user details by ID

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `user_id` | string | ✓ | The ID of the user |

### `whoami`

*📖 Read-only*

Get current authenticated user details

**Parameters**

_No parameters._

### `list_events`

*📖 Read-only*

List events for the authenticated user (before/after: YYYY-MM-DD)

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

List events for a project (before/after: YYYY-MM-DD)

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

Upload a file for use in markdown content

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path of the project |
| `file_path` | string | ✓ | Path to the file to upload |

### `download_attachment`

*📖 Read-only*

Download an uploaded file from a project (images returned as base64; use local_path to save to disk)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path of the project |
| `secret` | string | ✓ | The 32-character secret of the upload |
| `filename` | string | ✓ | The filename of the upload |
| `local_path` | string |  | Local path to save the file (optional, defaults to current directory) |
