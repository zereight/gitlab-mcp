### Fixed

- CI/CD catalog tools: honor the project allowlist and strict project scope. With `GITLAB_ALLOWED_PROJECT_IDS` or a session project scope (`X-GitLab-Allowed-Project-Ids`), `get_ci_catalog_resource` returns a resource only when its project is allowed, matched by full path or numeric project ID, whether it is looked up by `full_path` or by `id`; a resource from any other project returns `Access denied`. With `ENABLE_STRICT_PROJECT_SCOPE=true`, `list_ci_catalog_resources` is refused while an allowlist, a session project scope, or `GITLAB_PROJECT_ID` is set.

- `search_project_code` with an empty `project_id` searches the default project (the only allowed project, or `GITLAB_PROJECT_ID`) or returns an input error, instead of searching the whole instance.

### Changed

- With `ENABLE_STRICT_PROJECT_SCOPE=true`, `list_namespaces`, `get_namespace`, and `verify_namespace` are refused while an allowlist, a session project scope, or `GITLAB_PROJECT_ID` is set, like the other instance-wide and group-wide tools. User lookups (`get_users`, `get_user`, `whoami`) and `health_check` stay available.
