# Webhooks

Create, update, and delete project or group webhooks, and inspect recent webhook events.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=webhooks` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_webhooks`](#list_webhooks) — 📖 Read-only
- [`create_webhook`](#create_webhook) — ✏️ Writes
- [`update_webhook`](#update_webhook) — ✏️ Writes
- [`delete_webhook`](#delete_webhook) — ✏️ Writes
- [`list_webhook_events`](#list_webhook_events) — 📖 Read-only
- [`get_webhook_event`](#get_webhook_event) — 📖 Read-only

---

### `list_webhooks`

*📖 Read-only*

List webhooks for a project or group. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `create_webhook`

*✏️ Writes*

Create a webhook on a project or group. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `url` | string (uri) | ✓ | Webhook destination URL |
| `name` | string |  | Display name for the webhook |
| `description` | string |  | Description of the webhook |
| `token` | string |  | Secret token to validate received payloads. Not returned by GitLab in responses. |
| `signing_token` | string |  | HMAC signing token in whsec_<base64> form, where the Base64 suffix encodes a 32-byte key. Used for the webhook-signature header. Not returned by GitLab in responses. |
| `enable_ssl_verification` | boolean |  | Verify SSL when delivering the webhook |
| `push_events` | boolean |  | Trigger on push events |
| `push_events_branch_filter` | string |  | Only trigger push events for matching branches |
| `branch_filter_strategy` | enum (`wildcard` \| `regex` \| `all_branches`) |  | How push_events_branch_filter is interpreted |
| `issues_events` | boolean |  | Trigger on issue events |
| `confidential_issues_events` | boolean |  | Trigger on confidential issue events |
| `merge_requests_events` | boolean |  | Trigger on merge request events |
| `tag_push_events` | boolean |  | Trigger on tag push events |
| `note_events` | boolean |  | Trigger on note/comment events |
| `confidential_note_events` | boolean |  | Trigger on confidential note events |
| `job_events` | boolean |  | Trigger on job events |
| `pipeline_events` | boolean |  | Trigger on pipeline events |
| `wiki_page_events` | boolean |  | Trigger on wiki page events |
| `deployment_events` | boolean |  | Trigger on deployment events |
| `feature_flag_events` | boolean |  | Trigger on feature flag events |
| `releases_events` | boolean |  | Trigger on release events |
| `milestone_events` | boolean |  | Trigger on milestone events |
| `resource_access_token_events` | boolean |  | Trigger on access token expiry events |
| `resource_deploy_token_events` | boolean |  | Trigger on project deploy token expiry events (project webhooks) |
| `member_events` | boolean |  | Trigger on member events (group webhooks) |
| `project_events` | boolean |  | Trigger on project events (group webhooks) |
| `subgroup_events` | boolean |  | Trigger on subgroup events (group webhooks) |
| `custom_webhook_template` | string |  | Custom JSON payload template for the webhook |
| `custom_headers` | array<object> |  | Custom HTTP headers sent with the webhook. Each item has key and value strings. |

### `update_webhook`

*✏️ Writes*

Update an existing project or group webhook. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `hook_id` | number | ✓ | ID of the webhook to update |
| `url` | string (uri) | ✓ | Webhook destination URL |
| `name` | string |  | Display name for the webhook |
| `description` | string |  | Description of the webhook |
| `token` | string |  | Secret token to validate received payloads. Not returned by GitLab in responses. |
| `signing_token` | string |  | HMAC signing token in whsec_<base64> form, where the Base64 suffix encodes a 32-byte key. Used for the webhook-signature header. Not returned by GitLab in responses. |
| `enable_ssl_verification` | boolean |  | Verify SSL when delivering the webhook |
| `push_events` | boolean |  | Trigger on push events |
| `push_events_branch_filter` | string |  | Only trigger push events for matching branches |
| `branch_filter_strategy` | enum (`wildcard` \| `regex` \| `all_branches`) |  | How push_events_branch_filter is interpreted |
| `issues_events` | boolean |  | Trigger on issue events |
| `confidential_issues_events` | boolean |  | Trigger on confidential issue events |
| `merge_requests_events` | boolean |  | Trigger on merge request events |
| `tag_push_events` | boolean |  | Trigger on tag push events |
| `note_events` | boolean |  | Trigger on note/comment events |
| `confidential_note_events` | boolean |  | Trigger on confidential note events |
| `job_events` | boolean |  | Trigger on job events |
| `pipeline_events` | boolean |  | Trigger on pipeline events |
| `wiki_page_events` | boolean |  | Trigger on wiki page events |
| `deployment_events` | boolean |  | Trigger on deployment events |
| `feature_flag_events` | boolean |  | Trigger on feature flag events |
| `releases_events` | boolean |  | Trigger on release events |
| `milestone_events` | boolean |  | Trigger on milestone events |
| `resource_access_token_events` | boolean |  | Trigger on access token expiry events |
| `resource_deploy_token_events` | boolean |  | Trigger on project deploy token expiry events (project webhooks) |
| `member_events` | boolean |  | Trigger on member events (group webhooks) |
| `project_events` | boolean |  | Trigger on project events (group webhooks) |
| `subgroup_events` | boolean |  | Trigger on subgroup events (group webhooks) |
| `custom_webhook_template` | string |  | Custom JSON payload template for the webhook |
| `custom_headers` | array<object> |  | Custom HTTP headers sent with the webhook. Each item has key and value strings. |

### `delete_webhook`

*✏️ Writes*

Delete a project or group webhook. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `hook_id` | number | ✓ | ID of the webhook to delete |

### `list_webhook_events`

*📖 Read-only*

List recent webhook events (past 7 days). Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

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

Get full details of a specific webhook event. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string |  | Project ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `group_id` | string |  | Group ID or URL-encoded path. Provide either project_id or group_id, not both. |
| `hook_id` | number | ✓ | ID of the webhook |
| `event_id` | number | ✓ | ID of the webhook event to retrieve |
| `page` | number |  | If known, the page where the event is located (from list_webhook_events). Skips auto-pagination and fetches only this page. |
