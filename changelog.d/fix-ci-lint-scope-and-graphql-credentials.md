### Fixed

- `validate_ci_lint` and `validate_project_ci_lint`: with `GITLAB_ALLOWED_PROJECT_IDS` or a session project scope (`X-GitLab-Allowed-Project-Ids`), a lint result whose `include:` entries read from a project outside the allowlist (`include: project:`, a `local:` include inside such a file, or a CI/CD component) keeps `valid`, `errors`, and `warnings` but returns `merged_yaml` and `includes` as `null`, omits `jobs`, and adds a `scope_note`. Includes from allowed projects, templates, and remote URLs are unchanged. Without an allowlist nothing changes.

- `execute_graphql` refuses a query that selects a credential field (`token`, such as a pipeline trigger's token, or `ephemeralAuthenticationToken`), including under an alias or inside a fragment, and drops `token`, `runners_token`, and `import_url` keys from replies, like the REST tools. Use `create_pipeline_trigger` to get a new trigger token.
