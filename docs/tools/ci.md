# CI Lint

Validate `.gitlab-ci.yml` snippets and project pipeline configs.

## Tools in this group

- [`validate_ci_lint`](#validate_ci_lint) — 📖 Read-only
- [`validate_project_ci_lint`](#validate_project_ci_lint) — 📖 Read-only

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
