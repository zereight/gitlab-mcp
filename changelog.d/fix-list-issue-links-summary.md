### Changed

- When `GITLAB_MCP_LIST_SUMMARY_DEFAULT` is on, `list_issue_links` now follows the
  summary default like other list tools. A summarized reply still keeps
  `issue_link_id` and `link_type`. Pass `summary: false` for the full GitLab JSON.
