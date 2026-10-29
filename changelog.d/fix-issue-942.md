### Fixed

- With `GITLAB_MCP_LIST_SUMMARY_DEFAULT=true`, `list_branches`,
  `list_protected_branches`, `list_protected_tags`, `list_project_members`, and
  `list_group_members` now keep the full reply when `summary` is omitted. The
  summary dropped the fields these tools exist to answer (`protected` and
  `default` on branches, push/merge/unprotect/create access levels and
  `allow_force_push` on protected refs, `access_level` and `expires_at` on
  members). Passing `summary: true` still summarizes, and replies are unchanged
  when the variable is unset
  ([#942](https://github.com/zereight/gitlab-mcp/issues/942)).
