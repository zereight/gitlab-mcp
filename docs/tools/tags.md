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

List repository tags for a project. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

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

Get a repository tag by name. To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `create_tag`

*✏️ Writes*

Create a new repository tag. If the resource already exists, use the update tool. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |
| `ref` | string | ✓ | Create tag using commit SHA, another tag name, or branch name |
| `message` | string |  | Create annotated tag with message |

### `delete_tag`

*✏️ Writes*

Delete a repository tag. Verify the target first with a get or list tool. Changes or removes GitLab data and may be irreversible; needs permission. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `get_tag_signature`

*📖 Read-only*

Get the X.509 signature of a signed tag (404 if unsigned). To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The name of the tag |

### `list_protected_tags`

*📖 Read-only*

List protected tags in a project. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_protected_tag`

*📖 Read-only*

Get details of a single protected tag or wildcard (create access levels). To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `tag_name` | string | ✓ | Name of the protected tag or wildcard |

### `protect_tag`

*✏️ Writes*

Protect a repository tag or wildcard (set who can create it). Use this to protect a tag or wildcard such as `v*` so protected CI/CD variables reach tag pipelines; use `get_protected_tag` or `list_protected_tags` to inspect existing rules first. The operation changes who may create matching tags, requires maintainer-level permission, and returns the protection rule or a validation/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `tag_name` | string |  | Tag name or wildcard pattern to protect (for example v*). Required unless name is set. |
| `name` | string |  | Alias for tag_name. Required unless tag_name is set. |
| `create_access_level` | integer |  | Access level allowed to create matching tags (0=No access, 30=Developer, 40=Maintainer). GitLab default is 40 when omitted. |

### `unprotect_tag`

*✏️ Writes*

Remove protection from a previously protected tag or wildcard. Use this to remove protection from an existing tag or wildcard. To change the create access level, use `unprotect_tag` first, then `protect_tag`; `protect_tag` creates a rule and does not update an existing rule. This change is unavailable in `modify` mode because `unprotect_tag` is blocked there. The operation changes repository security controls, requires permission to manage protected tags, and returns the result or an error when the tag is missing or policy forbids the change.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `tag_name` | string | ✓ | Name of the protected tag or wildcard to unprotect |
