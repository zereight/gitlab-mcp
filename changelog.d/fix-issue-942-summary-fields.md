### Fixed

- The list summary now keeps the access and protection fields of the tools that
  return them: `protected`, `default`, `merged`, `can_push`,
  `developers_can_push` and `developers_can_merge` on `list_branches`;
  `*_access_levels`, `allow_force_push` and `code_owner_approval_required` on
  `list_protected_branches`; `create_access_levels` on `list_protected_tags`;
  `access_level` and `expires_at` on `list_project_members` and
  `list_group_members`. An explicit `summary: true` no longer drops them.

### Changed

- With `GITLAB_MCP_LIST_SUMMARY_DEFAULT=true`, `list_branches` is summarized
  again when `summary` is omitted: it keeps the fields above and drops the last
  commit. Pass `summary: false` for the commit details
  ([#942](https://github.com/zereight/gitlab-mcp/issues/942)).
