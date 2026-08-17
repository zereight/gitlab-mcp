# Milestones

Project and group milestone CRUD plus associated issues/MRs and burndown events.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=milestones` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_MILESTONE=true` flag for backward compatibility.

## Tools in this group

- [`list_milestones`](#list_milestones) — 📖 Read-only
- [`get_milestone`](#get_milestone) — 📖 Read-only
- [`create_milestone`](#create_milestone) — ✏️ Writes
- [`edit_milestone`](#edit_milestone) — ✏️ Writes
- [`delete_milestone`](#delete_milestone) — ✏️ Writes
- [`get_milestone_issue`](#get_milestone_issue) — 📖 Read-only
- [`get_milestone_merge_requests`](#get_milestone_merge_requests) — 📖 Read-only
- [`promote_milestone`](#promote_milestone) — ✏️ Writes
- [`get_milestone_burndown_events`](#get_milestone_burndown_events) — 📖 Read-only
- [`list_group_milestones`](#list_group_milestones) — 📖 Read-only
- [`get_group_milestone`](#get_group_milestone) — 📖 Read-only
- [`create_group_milestone`](#create_group_milestone) — ✏️ Writes
- [`edit_group_milestone`](#edit_group_milestone) — ✏️ Writes
- [`delete_group_milestone`](#delete_group_milestone) — ✏️ Writes
- [`get_group_milestone_issue`](#get_group_milestone_issue) — 📖 Read-only
- [`get_group_milestone_merge_requests`](#get_group_milestone_merge_requests) — 📖 Read-only
- [`get_group_milestone_burndown_events`](#get_group_milestone_burndown_events) — 📖 Read-only

---

### `list_milestones`

*📖 Read-only*

List milestones with filtering options. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `iids` | array<number> |  | Return only the milestones having the given iid |
| `state` | enum (`active` \| `closed`) |  | Return only active or closed milestones |
| `title` | string |  | Return only milestones with a title matching the provided string |
| `search` | string |  | Return only milestones with a title or description matching the provided string |
| `include_ancestors` | boolean |  | Include ancestor groups |
| `updated_before` | string |  | Return milestones updated before the specified date (ISO 8601 format) |
| `updated_after` | string |  | Return milestones updated after the specified date (ISO 8601 format) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_milestone`

*📖 Read-only*

Get details of a specific milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |

### `create_milestone`

*✏️ Writes*

Create a new milestone. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `title` | string | ✓ | The title of the milestone |
| `description` | string |  | The description of the milestone |
| `due_date` | string |  | The due date of the milestone (YYYY-MM-DD) |
| `start_date` | string |  | The start date of the milestone (YYYY-MM-DD) |

### `edit_milestone`

*✏️ Writes*

Edit an existing milestone. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |
| `title` | string |  | The title of the milestone |
| `description` | string |  | The description of the milestone |
| `due_date` | string |  | The due date of the milestone (YYYY-MM-DD) |
| `start_date` | string |  | The start date of the milestone (YYYY-MM-DD) |
| `state_event` | enum (`close` \| `activate`) |  | The state event of the milestone |

### `delete_milestone`

*✏️ Writes*

Delete a milestone. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |

### `get_milestone_issue`

*📖 Read-only*

Get issues associated with a specific milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_milestone_merge_requests`

*📖 Read-only*

Get merge requests associated with a specific milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `promote_milestone`

*✏️ Writes*

Promote a milestone to the next stage. Use this for the specific operation described; choose a sibling tool when you need a different resource or lifecycle action. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |

### `get_milestone_burndown_events`

*📖 Read-only*

Get burndown events for a specific milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `milestone_id` | string | ✓ | The ID of a project milestone |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_group_milestones`

*📖 Read-only*

List group milestones with filtering options. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `iids` | array<number> |  | Return only the milestones having the given iid |
| `state` | enum (`active` \| `closed`) |  | Return only active or closed milestones |
| `title` | string |  | Return only milestones with a title matching the provided string |
| `search` | string |  | Return only milestones with a title or description matching the provided string |
| `include_ancestors` | boolean |  | Include ancestor groups |
| `include_descendants` | boolean |  | Include descendant groups |
| `updated_before` | string |  | Return milestones updated before the specified date (ISO 8601 format) |
| `updated_after` | string |  | Return milestones updated after the specified date (ISO 8601 format) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_group_milestone`

*📖 Read-only*

Get details of a specific group milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `milestone_id` | string | ✓ | The ID of a group milestone |

### `create_group_milestone`

*✏️ Writes*

Create a new group milestone. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `title` | string | ✓ | The title of the milestone |
| `description` | string |  | The description of the milestone |
| `due_date` | string |  | The due date of the milestone (YYYY-MM-DD) |
| `start_date` | string |  | The start date of the milestone (YYYY-MM-DD) |

### `edit_group_milestone`

*✏️ Writes*

Edit an existing group milestone. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `milestone_id` | string | ✓ | The ID of a group milestone |
| `title` | string |  | The title of the milestone |
| `description` | string |  | The description of the milestone |
| `due_date` | string |  | The due date of the milestone (YYYY-MM-DD) |
| `start_date` | string |  | The start date of the milestone (YYYY-MM-DD) |
| `state_event` | enum (`close` \| `activate`) |  | The state event of the milestone |

### `delete_group_milestone`

*✏️ Writes*

Delete a group milestone. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `milestone_id` | string | ✓ | The ID of a group milestone |

### `get_group_milestone_issue`

*📖 Read-only*

Get issues associated with a specific group milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `milestone_id` | string | ✓ | The ID of a group milestone |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_group_milestone_merge_requests`

*📖 Read-only*

Get merge requests associated with a specific group milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `milestone_id` | string | ✓ | The ID of a group milestone |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_group_milestone_burndown_events`

*📖 Read-only*

Get burndown events for a specific group milestone. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `milestone_id` | string | ✓ | The ID of a group milestone |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |
