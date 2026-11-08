### Breaking changes

- Remove `GITLAB_ALLOWED_GROUPS` / `--allowed-groups`; use `GITLAB_OAUTH_ALLOWED_GROUPS` / `--oauth-allowed-groups`, which is enforced only with `GITLAB_MCP_OAUTH=true`. A non-empty value now stops startup (server, human CLI, and OAuth `auth`) instead of silently dropping the group restriction; the error names the setting but not the configured groups.
