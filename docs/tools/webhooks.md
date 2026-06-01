# Webhooks

List webhooks configured on projects or groups, and inspect recent webhook events.

## Tools in this group

- [`list_webhooks`](#list_webhooks) — 📖 Read-only
- [`list_webhook_events`](#list_webhook_events) — 📖 Read-only
- [`get_webhook_event`](#get_webhook_event) — 📖 Read-only

---

### `list_webhooks`

*📖 Read-only*

List webhooks for a project or group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_webhook_events`

*📖 Read-only*

List recent webhook events (past 7 days)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `hook_id` | number | ✓ | ID of the webhook |
| `status` | number \| string |  | Filter by response status code (e.g. 200, 500) or category: successful, client_failure, server_failure |
| `summary` | boolean |  | If true, return only summary fields (id, url, trigger, response_status, execution_duration) without full request/response payloads. Recommended for overview queries to avoid huge responses. |
| `per_page` | number |  | Number of events per page |
| `page` | number |  | Page number for pagination |

### `get_webhook_event`

*📖 Read-only*

Get full details of a specific webhook event

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `hook_id` | number | ✓ | ID of the webhook |
| `event_id` | number | ✓ | ID of the webhook event to retrieve |
| `page` | number |  | If known, the page where the event is located (from list_webhook_events). Skips auto-pagination and fetches only this page. |
