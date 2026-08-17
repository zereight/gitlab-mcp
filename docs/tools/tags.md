# Tags

Tag listing, creation, deletion, and signature inspection.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=tags` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_tags`](#list_tags) — 📖 Read-only
- [`get_tag`](#get_tag) — 📖 Read-only
- [`create_tag`](#create_tag) — ✏️ Writes
- [`delete_tag`](#delete_tag) — ✏️ Writes
- [`get_tag_signature`](#get_tag_signature) — 📖 Read-only

---

### `list_tags`

*📖 Read-only*

List repository tags for a project. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `order_by` | enum (`name` \| `updated` \| `version`) |  | Return tags ordered by name, updated, or version. Default is updated. |
| `sort` | enum (`asc` \| `desc`) |  | Sort direction |
| `search` | string |  | Restrict on tag name. You can use ^term and term$ to find tags that begin and end with term. No other regular expressions are supported. |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_tag`

*📖 Read-only*

Get a repository tag by name. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `create_tag`

*✏️ Writes*

Create a new repository tag. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |
| `ref` | string | ✓ | Create tag using commit SHA, another tag name, or branch name |
| `message` | string |  | Create annotated tag with message |

### `delete_tag`

*✏️ Writes*

Delete a repository tag. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `get_tag_signature`

*📖 Read-only*

Get the X.509 signature of a signed tag (404 if unsigned). Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |
