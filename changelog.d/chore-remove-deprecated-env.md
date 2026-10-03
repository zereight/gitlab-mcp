### Breaking changes

- Remove `GITLAB_READ_ONLY_MODE` / `--read-only`; use `GITLAB_PERMISSION_MODE=readonly` / `--permission-mode=readonly`.
- Remove `GITLAB_ALLOWED_GROUPS` / `--allowed-groups`; use `GITLAB_OAUTH_ALLOWED_GROUPS` / `--oauth-allowed-groups`.
- Remove `USE_GITLAB_WIKI` / `--use-wiki`, `USE_MILESTONE` / `--use-milestone`, and `USE_PIPELINE` / `--use-pipeline`; append `wiki`, `milestones`, or `pipelines` to `GITLAB_TOOLSETS` / `--toolsets`. Keep `core` when replacing an unset list. Leave an existing `all` unchanged. For CI lint, also append `validate_ci_lint,validate_project_ci_lint` to `GITLAB_TOOLS` / `--tools` instead of replacing an existing tool list.
- Active removed settings now stop startup with migration guidance (including Docker Compose and OAuth auth), rather than silently dropping read-only or group restrictions. Empty/false legacy switches remain harmless; remove them from configuration.
