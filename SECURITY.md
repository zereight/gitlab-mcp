# Security policy

## Report a vulnerability

Report a vulnerability with [GitHub private vulnerability reporting](https://github.com/zereight/gitlab-mcp/security/advisories/new).

Do not report a vulnerability in a public GitHub issue. A public issue shows the details before a fix is available.

Include the package version, the impact, and steps to reproduce. Remove tokens, passwords, cookies, and `Authorization` headers from any log you attach.

## Supported versions

Security fixes are provided for the latest 2.x release.

| Version        | Supported |
| -------------- | --------- |
| Latest 2.x     | Yes       |
| Older releases | No        |

## Security controls

The controls below are implemented in this repository and described in the linked docs.

### Permission mode

`GITLAB_PERMISSION_MODE` chooses the exposed tool surface. The values are `readonly`, `modify`, and `full`. The default is `full`. `readonly` exposes read tools. `modify` allows create and update, and blocks delete and teardown tools, including destructive mutations sent through `execute_graphql`. An invalid value fails startup.

See [`GITLAB_PERMISSION_MODE`](docs/configuration/environment-variables.md#gitlab_permission_mode).

### Project allowlist

`GITLAB_ALLOWED_PROJECT_IDS` is an optional comma-separated list of project ids. The list is fixed when the process starts. One id acts as a locked default project. Multiple ids restrict tool access to those projects.

Without `ENABLE_STRICT_PROJECT_SCOPE=true`, that allowlist limits which projects tools may operate on. Listings and searches can still return everything the token can see. With the flag, the server filters `list_projects`, `list_group_projects`, and `search_repositories` down to the allowlist. On `search_repositories`, `count` and `total_pages` stay the unfiltered GitLab totals when GitLab sends `x-total` and `x-total-pages`. If GitLab omits `x-total`, `count` is the length of the filtered page. If GitLab omits `x-total-pages`, the response omits `total_pages`. The flag also refuses instance-wide and group-wide tools when `GITLAB_ALLOWED_PROJECT_IDS`, a session project scope, or `GITLAB_PROJECT_ID` is set. It cannot limit those tools to those projects.

See [`GITLAB_ALLOWED_PROJECT_IDS`](docs/configuration/environment-variables.md#gitlab_allowed_project_ids) and [`ENABLE_STRICT_PROJECT_SCOPE`](docs/configuration/environment-variables.md#enable_strict_project_scope).

### Response masking

Set `GITLAB_MASKING_ENABLED` to `true` to mask sensitive text in GitLab tool results and returned error messages. The default is `false`. When masking is off, the server does not read a masking configuration file.

See [Response masking](docs/configuration/environment-variables.md#response-masking).
