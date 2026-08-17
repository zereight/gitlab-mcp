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

Get dependency proxy settings for a group. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |

### `update_dependency_proxy_settings`

*✏️ Writes*

Update dependency proxy settings for a group (enable/disable, credentials for authenticated Docker Hub pulls). Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `enabled` | boolean |  | Enable or disable the dependency proxy |
| `identity` | string |  | Proxy username for authenticated Docker Hub pulls (Premium/Ultimate) |
| `secret` | string |  | Proxy password / access token for authenticated pulls |

### `list_dependency_proxy_blobs`

*📖 Read-only*

List cached dependency proxy blobs for a group. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `first` | integer |  | Number of blobs to return (default: 20) |
| `after` | string |  | Cursor for pagination (from previous response pageInfo.endCursor) |

### `purge_dependency_proxy_cache`

*✏️ Writes*

Schedule purge of all cached dependency proxy blobs for a group. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
