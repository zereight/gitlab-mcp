# Dependency Proxy

Inspect and manage the GitLab dependency proxy cache settings, blob storage, and purge operations.

## Tools in this group

- [`get_dependency_proxy_settings`](#get_dependency_proxy_settings) — 📖 Read-only
- [`update_dependency_proxy_settings`](#update_dependency_proxy_settings) — ✏️ Writes
- [`list_dependency_proxy_blobs`](#list_dependency_proxy_blobs) — 📖 Read-only
- [`purge_dependency_proxy_cache`](#purge_dependency_proxy_cache) — ✏️ Writes

---

### `get_dependency_proxy_settings`

*📖 Read-only*

Get dependency proxy settings for a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |

### `update_dependency_proxy_settings`

*✏️ Writes*

Update dependency proxy settings for a group (enable/disable, credentials for authenticated Docker Hub pulls)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `enabled` | boolean |  | Enable or disable the dependency proxy |
| `identity` | string |  | Proxy username for authenticated Docker Hub pulls (Premium/Ultimate) |
| `secret` | string |  | Proxy password / access token for authenticated pulls |

### `list_dependency_proxy_blobs`

*📖 Read-only*

List cached dependency proxy blobs for a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `first` | integer |  | Number of blobs to return (default: 20) |
| `after` | string |  | Cursor for pagination (from previous response pageInfo.endCursor) |

### `purge_dependency_proxy_cache`

*✏️ Writes*

Schedule purge of all cached dependency proxy blobs for a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
