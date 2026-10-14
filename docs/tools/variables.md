# Variables

Project and group CI/CD variable CRUD.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=variables` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_project_variables`](#list_project_variables) — 📖 Read-only
- [`get_project_variable`](#get_project_variable) — 📖 Read-only
- [`create_project_variable`](#create_project_variable) — ✏️ Writes
- [`update_project_variable`](#update_project_variable) — ✏️ Writes
- [`delete_project_variable`](#delete_project_variable) — ✏️ Writes
- [`list_group_variables`](#list_group_variables) — 📖 Read-only
- [`get_group_variable`](#get_group_variable) — 📖 Read-only
- [`create_group_variable`](#create_group_variable) — ✏️ Writes
- [`update_group_variable`](#update_group_variable) — ✏️ Writes
- [`delete_group_variable`](#delete_group_variable) — ✏️ Writes

---

### `list_project_variables`

*📖 Read-only*

List CI/CD variables for a project. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `filter` | object |  | Filter by environment scope (e.g. '*', 'production') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_project_variable`

*📖 Read-only*

Get a single CI/CD variable from a project. To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable |
| `filter` | object |  | Filter by environment scope |

### `create_project_variable`

*✏️ Writes*

Create a CI/CD variable for a project. If the resource already exists, use the update tool. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable (must match /[a-zA-Z0-9_]+/) |
| `value` | string | ✓ | The value of the variable |
| `variable_type` | enum (`env_var` \| `file`) |  | The type of variable: 'env_var' (default) or 'file' |
| `protected` | boolean |  | Whether the variable is only available on protected branches/tags |
| `masked` | boolean |  | Whether the variable value is masked in job logs |
| `raw` | boolean |  | Whether the variable is not expanded (treated as raw string) |
| `environment_scope` | string |  | Environment scope (e.g. '*', 'production'). Default: '*' |
| `description` | string |  | Description of the variable |

### `update_project_variable`

*✏️ Writes*

Update an existing CI/CD variable in a project. Use the create tool for new resources and a note tool for comments. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable to update |
| `value` | string | ✓ | The new value of the variable |
| `variable_type` | enum (`env_var` \| `file`) |  | The type of variable |
| `protected` | boolean |  | Whether the variable is protected |
| `masked` | boolean |  | Whether the variable value is masked in job logs |
| `raw` | boolean |  | Whether the variable is not expanded |
| `environment_scope` | string |  | New environment scope to assign to the variable (renames the scope, e.g. '*', 'production'). Use filter.environment_scope to identify which variable to update when multiple share the same key. |
| `description` | string |  | Description of the variable |
| `filter` | object |  | Identifies which variable to update when multiple variables share the same key across different environment scopes |

### `delete_project_variable`

*✏️ Writes*

Delete a CI/CD variable from a project. Verify the target first with a get or list tool. Changes or removes GitLab data and may be irreversible; needs permission. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable to delete |
| `filter` | object |  | Filter by environment scope to disambiguate when multiple variables share the same key |

### `list_group_variables`

*📖 Read-only*

List CI/CD variables for a group. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `filter` | object |  | Filter by environment scope (e.g. '*', 'production') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_group_variable`

*📖 Read-only*

Get a single CI/CD variable from a group. To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable |
| `filter` | object |  | Filter by environment scope |

### `create_group_variable`

*✏️ Writes*

Create a CI/CD variable for a group. If the resource already exists, use the update tool. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable (must match /[a-zA-Z0-9_]+/) |
| `value` | string | ✓ | The value of the variable |
| `variable_type` | enum (`env_var` \| `file`) |  | The type of variable: 'env_var' (default) or 'file' |
| `protected` | boolean |  | Whether the variable is only available on protected branches/tags |
| `masked` | boolean |  | Whether the variable value is masked in job logs |
| `raw` | boolean |  | Whether the variable is not expanded (treated as raw string) |
| `environment_scope` | string |  | Environment scope (e.g. '*', 'production'). Default: '*' |
| `description` | string |  | Description of the variable |

### `update_group_variable`

*✏️ Writes*

Update an existing CI/CD variable in a group. Use the create tool for new resources and a note tool for comments. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable to update |
| `value` | string | ✓ | The new value of the variable |
| `variable_type` | enum (`env_var` \| `file`) |  | The type of variable |
| `protected` | boolean |  | Whether the variable is protected |
| `masked` | boolean |  | Whether the variable value is masked in job logs |
| `raw` | boolean |  | Whether the variable is not expanded |
| `environment_scope` | string |  | New environment scope to assign to the variable (renames the scope, e.g. '*', 'production'). Use filter.environment_scope to identify which variable to update when multiple share the same key. |
| `description` | string |  | Description of the variable |
| `filter` | object |  | Identifies which variable to update when multiple variables share the same key across different environment scopes |

### `delete_group_variable`

*✏️ Writes*

Delete a CI/CD variable from a group. Verify the target first with a get or list tool. Changes or removes GitLab data and may be irreversible; needs permission. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `key` | string | ✓ | The key of the variable to delete |
| `filter` | object |  | Filter by environment scope to disambiguate when multiple variables share the same key |
