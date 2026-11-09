### Breaking changes

- Remove `USE_GITLAB_WIKI` / `--use-wiki`, `USE_MILESTONE` / `--use-milestone`, and `USE_PIPELINE` / `--use-pipeline`; append `wiki`, `milestones`, or `pipelines` to `GITLAB_TOOLSETS` / `--toolsets`. Keep `core` when replacing an unset list. Leave an existing `all` unchanged. For CI lint, also append `validate_ci_lint,validate_project_ci_lint` to `GITLAB_TOOLS` / `--tools` instead of replacing an existing tool list.
- An active `USE_GITLAB_WIKI`, `USE_MILESTONE`, or `USE_PIPELINE` (`true` or a bare `--use-*` flag) now stops startup with migration guidance, including under Docker Compose, rather than silently hiding those tools. Empty/false values remain harmless; remove them from configuration.
