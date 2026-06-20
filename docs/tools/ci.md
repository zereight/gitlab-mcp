# CI Lint

Validate `.gitlab-ci.yml` snippets and project pipeline configs.

## Tools in this group

- [`validate_ci_lint`](#validate_ci_lint) — 📖 Read-only
- [`validate_project_ci_lint`](#validate_project_ci_lint) — 📖 Read-only
- [`list_ci_catalog_resources`](#list_ci_catalog_resources) — 📖 Read-only
- [`get_ci_catalog_resource`](#get_ci_catalog_resource) — 📖 Read-only

---

### `validate_ci_lint`

*📖 Read-only*

Validate provided GitLab CI/CD YAML content for a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `content` | string | ✓ | GitLab CI/CD YAML content to validate |
| `dry_run` | boolean |  | Run pipeline creation simulation |
| `include_jobs` | boolean |  | Include jobs in the lint response |
| `ref` | string |  | Branch or tag context for dry_run validation |

### `validate_project_ci_lint`

*📖 Read-only*

Validate an existing .gitlab-ci.yml configuration for a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `content_ref` | string |  | Commit SHA, branch, or tag to read the existing CI config from |
| `dry_run` | boolean |  | Run pipeline creation simulation |
| `dry_run_ref` | string |  | Branch or tag context for dry_run validation |
| `include_jobs` | boolean |  | Include jobs in the lint response |

### `list_ci_catalog_resources`

*📖 Read-only*

List GitLab CI/CD Catalog resources/components visible to the user

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string |  | Search catalog resources by name or description |
| `first` | integer |  | Number of resources to return (default: 20, max: 100) |
| `after` | string |  | GraphQL cursor for the next page |
| `group_ids` | array<string> |  | Filter to catalog resources in these group IDs |
| `scope` | enum (`ALL` \| `NAMESPACES`) |  | Catalog resource scope |
| `sort` | enum (`CREATED_ASC` \| `CREATED_DESC` \| `LATEST_RELEASED_AT_ASC` \| `LATEST_RELEASED_AT_DESC` \| `NAME_ASC` \| `NAME_DESC` \| `STAR_COUNT_ASC` \| `STAR_COUNT_DESC` \| `USAGE_COUNT_ASC` \| `USAGE_COUNT_DESC`) |  | Sort order |
| `topics` | array<string> |  | Filter by project topic names |
| `verification_level` | enum (`GITLAB_MAINTAINED` \| `GITLAB_PARTNER_MAINTAINED` \| `UNVERIFIED` \| `VERIFIED_CREATOR_MAINTAINED` \| `VERIFIED_CREATOR_SELF_MANAGED`) |  | Filter by verification level |

### `get_ci_catalog_resource`

*📖 Read-only*

Get details for a GitLab CI/CD Catalog resource, including versions and components

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `version_limit` | integer |  | Number of versions to include (default: 5, max: 20) |
| `component_limit` | integer |  | Number of components per version to include (default: 20, max: 50) |
| `component_name` | string |  | Filter returned components by component name |
| `include_readme` | boolean |  | Include version README content |
| `id` | string |  | CI/CD Catalog resource global ID. Required when full_path is omitted. |
| `full_path` | string |  | CI/CD Catalog resource full project path. Required when id is omitted. |
