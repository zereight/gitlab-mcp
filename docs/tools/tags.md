# Tags

Tag listing, creation, deletion, signature inspection, and protected tag rules.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=tags` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_tags`](#list_tags) — 📖 Read-only
- [`get_tag`](#get_tag) — 📖 Read-only
- [`create_tag`](#create_tag) — ✏️ Writes
- [`delete_tag`](#delete_tag) — ✏️ Writes
- [`get_tag_signature`](#get_tag_signature) — 📖 Read-only
- [`list_protected_tags`](#list_protected_tags) — 📖 Read-only
- [`get_protected_tag`](#get_protected_tag) — 📖 Read-only
- [`protect_tag`](#protect_tag) — ✏️ Writes
- [`unprotect_tag`](#unprotect_tag) — ✏️ Writes

---

### `list_tags`

*📖 Read-only*

List repository tags for a project. For one known resource, use the matching get tool.

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

Get a repository tag by name. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `create_tag`

*✏️ Writes*

Create a new repository tag.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |
| `ref` | string | ✓ | Create tag using commit SHA, another tag name, or branch name |
| `message` | string |  | Create annotated tag with message |

### `delete_tag`

*✏️ Writes*

Delete a repository tag. Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `get_tag_signature`

*📖 Read-only*

Get the X.509 signature of a signed tag (404 if unsigned).

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `list_protected_tags`

*📖 Read-only*

List protected tags in a project. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_protected_tag`

*📖 Read-only*

Get details of a single protected tag or wildcard (create access levels). To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `tag_name` | string | ✓ | Name of the protected tag or wildcard |

### `protect_tag`

*✏️ Writes*

Protect a repository tag or wildcard (set who can create it). Protect a tag or wildcard such as `v*` so protected CI/CD variables reach tag pipelines. Inspect first with `get_protected_tag` or `list_protected_tags`.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `tag_name` | string |  | Tag name or wildcard pattern to protect (for example v*). Required unless name is set. |
| `name` | string |  | Alias for tag_name. Required unless tag_name is set. |
| `create_access_level` | integer |  | Access level allowed to create matching tags (0=No access, 30=Developer, 40=Maintainer). GitLab default is 40 when omitted. |

### `unprotect_tag`

*✏️ Writes*

Remove protection from a previously protected tag or wildcard. Remove tag protection. To change create access, `unprotect_tag` then `protect_tag`. Blocked in `modify` mode.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `tag_name` | string | ✓ | Name of the protected tag or wildcard to unprotect |
