### Added

- `list_issue_label_events` and `list_issue_state_events` in the `issues`
  toolset return an issue's label history and state history, through
  `GET /projects/:id/issues/:issue_iid/resource_label_events` and
  `.../resource_state_events`. Each event is lean: `created_at`,
  `user.username`, and `action` with `label.name` (`label` is `null` for a
  deleted label) or `state`. Both take `page` and `per_page` and return the
  events in GitLab's order. They are read tools, listed in every
  `GITLAB_PERMISSION_MODE`, and keep the full reply when
  `GITLAB_MCP_LIST_SUMMARY_DEFAULT=true`
  ([#1003](https://github.com/zereight/gitlab-mcp/issues/1003))
