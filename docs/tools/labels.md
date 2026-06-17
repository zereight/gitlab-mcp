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

List labels for a project

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

Get a single label from a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `label_id` | string | ✓ | The ID or title of a project's label |
| `include_ancestor_groups` | boolean |  | Include ancestor groups |

### `create_label`

*✏️ Writes*

Create a new label in a project

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

Update an existing label in a project

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

Delete a label from a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `label_id` | string | ✓ | The ID or title of a project's label |
