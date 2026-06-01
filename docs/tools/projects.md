# Projects & Namespaces

Project/namespace listing, member queries, group iterations, and server health.

## Tools in this group

- [`get_project`](#get_project) — 📖 Read-only
- [`list_projects`](#list_projects) — 📖 Read-only
- [`list_project_members`](#list_project_members) — 📖 Read-only
- [`list_namespaces`](#list_namespaces) — 📖 Read-only
- [`get_namespace`](#get_namespace) — 📖 Read-only
- [`verify_namespace`](#verify_namespace) — 📖 Read-only
- [`list_group_projects`](#list_group_projects) — 📖 Read-only
- [`list_group_iterations`](#list_group_iterations) — 📖 Read-only
- [`health_check`](#health_check) — 📖 Read-only

---

### `get_project`

*📖 Read-only*

Get details of a specific project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |

### `list_projects`

*📖 Read-only*

List projects accessible by the current user

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search term for projects |
| `search_namespaces` | boolean |  | Needs to be true if search is full path |
| `owned` | boolean |  | Filter for projects owned by current user |
| `membership` | boolean |  | Filter for projects where current user is a member |
| `simple` | boolean |  | Return only limited fields |
| `archived` | boolean |  | Filter for archived projects |
| `visibility` | enum (`public` \| `internal` \| `private`) |  | Filter by project visibility |
| `order_by` | enum (`id` \| `name` \| `path` \| `created_at` \| `updated_at` \| `last_activity_at`) |  | Return projects ordered by field |
| `sort` | enum (`asc` \| `desc`) |  | Return projects sorted in ascending or descending order |
| `with_issues_enabled` | boolean |  | Filter projects with issues feature enabled |
| `with_merge_requests_enabled` | boolean |  | Filter projects with merge requests feature enabled |
| `min_access_level` | number |  | Filter by minimum access level |
| `topic` | string |  | Filter by topic (projects tagged with this topic) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_project_members`

*📖 Read-only*

List members of a GitLab project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `query` | string |  | Search for members by name or username |
| `user_ids` | array<number> |  | Filter by user IDs |
| `skip_users` | array<number> |  | User IDs to exclude |
| `include_inheritance` | boolean |  | Include inherited members. Defaults to false. |
| `per_page` | number |  | Number of items per page (default: 20, max: 100) |
| `page` | number |  | Page number for pagination (default: 1) |

### `list_namespaces`

*📖 Read-only*

List all namespaces (users and groups) available to the current user. Filter by kind='group' for groups only.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search term for namespaces |
| `owned` | boolean |  | Filter for namespaces owned by current user |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_namespace`

*📖 Read-only*

Get details of a namespace (user or group) by ID or path. Groups are namespaces with kind='group'.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `namespace_id` | string | ✓ | Namespace ID or full path |

### `verify_namespace`

*📖 Read-only*

Verify if a namespace path exists

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `path` | string | ✓ | Namespace path to verify |

### `list_group_projects`

*📖 Read-only*

List projects in a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or path |
| `include_subgroups` | boolean |  | Include projects from subgroups |
| `search` | string |  | Search term to filter projects |
| `order_by` | enum (`name` \| `path` \| `created_at` \| `updated_at` \| `last_activity_at`) |  | Field to sort by |
| `sort` | enum (`asc` \| `desc`) |  | Sort direction |
| `archived` | boolean |  | Filter for archived projects |
| `visibility` | enum (`public` \| `internal` \| `private`) |  | Filter by project visibility |
| `with_issues_enabled` | boolean |  | Filter projects with issues feature enabled |
| `with_merge_requests_enabled` | boolean |  | Filter projects with merge requests feature enabled |
| `min_access_level` | number |  | Filter by minimum access level |
| `with_programming_language` | string |  | Filter by programming language |
| `starred` | boolean |  | Filter by starred projects |
| `statistics` | boolean |  | Include project statistics |
| `with_custom_attributes` | boolean |  | Include custom attributes |
| `with_security_reports` | boolean |  | Include security reports |
| `topic` | string |  | Filter by topic (projects tagged with this topic) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `list_group_iterations`

*📖 Read-only*

List group iterations with filtering options

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `state` | enum (`opened` \| `upcoming` \| `current` \| `closed` \| `all`) |  | Return opened, upcoming, current, closed, or all iterations. |
| `search` | string |  | Return only iterations with a title matching the provided string. |
| `search_in` | array<enum (`title` \| `cadence_title`)> |  | Fields in which fuzzy search should be performed with the query given in the argument search. The available options are title and cadence_title. Default is [title]. |
| `include_ancestors` | boolean |  | Include iterations for group and its ancestors. Defaults to true. |
| `include_descendants` | boolean |  | Include iterations for group and its descendants. Defaults to false. |
| `updated_before` | string |  | Return only iterations updated before the given datetime. Expected in ISO 8601 format (2019-03-15T08:00:00Z). |
| `updated_after` | string |  | Return only iterations updated after the given datetime. Expected in ISO 8601 format (2019-03-15T08:00:00Z). |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `health_check`

*📖 Read-only*

Verify server status and authentication

**Parameters**

_No parameters._
