# Dependency Proxy

Inspect and manage the GitLab dependency proxy cache settings, blob storage, and purge operations.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=dependency_proxy` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`get_dependency_proxy_settings`](#get_dependency_proxy_settings) — 📖 Read-only
- [`update_dependency_proxy_settings`](#update_dependency_proxy_settings) — ✏️ Writes
- [`list_dependency_proxy_blobs`](#list_dependency_proxy_blobs) — 📖 Read-only
- [`purge_dependency_proxy_cache`](#purge_dependency_proxy_cache) — ✏️ Writes

---

### `get_dependency_proxy_settings`

*📖 Read-only*

Get dependency proxy settings for a group. To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |

### `update_dependency_proxy_settings`

*✏️ Writes*

Update dependency proxy settings for a group (enable/disable, credentials for authenticated Docker Hub pulls). Use the create tool for new resources and a note tool for comments. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `enabled` | boolean |  | Enable or disable the dependency proxy |
| `identity` | string |  | Proxy username for authenticated Docker Hub pulls (Premium/Ultimate) |
| `secret` | string |  | Proxy password / access token for authenticated pulls |

### `list_dependency_proxy_blobs`

*📖 Read-only*

List cached dependency proxy blobs for a group. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `first` | integer |  | Number of blobs to return (default: 20) |
| `after` | string |  | Cursor for pagination (from previous response pageInfo.endCursor) |

### `purge_dependency_proxy_cache`

*✏️ Writes*

Schedule purge of all cached dependency proxy blobs for a group. Changes or removes GitLab data and may be irreversible; needs permission. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
