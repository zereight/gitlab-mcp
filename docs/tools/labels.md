# Labels

Project label CRUD.

## Tools in this group

- [`list_labels`](#list_labels) — 📖 Read-only
- [`get_label`](#get_label) — 📖 Read-only
- [`create_label`](#create_label) — ✏️ Writes
- [`update_label`](#update_label) — ✏️ Writes
- [`delete_label`](#delete_label) — ✏️ Writes

---

### `list_labels`

*📖 Read-only*

List labels for a project. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `with_counts` | boolean |  | Whether to include issue and merge request counts |
| `include_ancestor_groups` | boolean |  | Include ancestor groups |
| `search` | string |  | Keyword to filter labels by |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_label`

*📖 Read-only*

Get a single label from a project. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `label_id` | string | ✓ | The ID or title of a project's label |
| `include_ancestor_groups` | boolean |  | Include ancestor groups |

### `create_label`

*✏️ Writes*

Create a new label in a project. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `name` | string | ✓ | The name of the label |
| `color` | string | ✓ | The color of the label given in 6-digit hex notation with leading '#' sign |
| `description` | string |  | The description of the label |
| `priority` | number \| null |  | The priority of the label |

### `update_label`

*✏️ Writes*

Update an existing label in a project. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `label_id` | string | ✓ | The ID or title of a project's label |
| `new_name` | string |  | The new name of the label |
| `color` | string |  | The color of the label given in 6-digit hex notation with leading '#' sign |
| `description` | string |  | The new description of the label |
| `priority` | number \| null |  | The new priority of the label |

### `delete_label`

*✏️ Writes*

Delete a label from a project. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `label_id` | string | ✓ | The ID or title of a project's label |
