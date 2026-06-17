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

List repository tags for a project

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

Get a repository tag by name

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `create_tag`

*✏️ Writes*

Create a new repository tag

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |
| `ref` | string | ✓ | Create tag using commit SHA, another tag name, or branch name |
| `message` | string |  | Create annotated tag with message |

### `delete_tag`

*✏️ Writes*

Delete a repository tag

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `get_tag_signature`

*📖 Read-only*

Get the X.509 signature of a signed tag (404 if unsigned)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |
