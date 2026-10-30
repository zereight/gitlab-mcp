### Fixed

- With `GITLAB_MCP_LIST_SUMMARY_DEFAULT=true`, `list_group_iterations`,
  `list_project_iterations`, and `list_group_iteration_cadences` now keep the
  full reply when `summary` is omitted. The summary dropped `start_date` and
  `due_date` (and the cadence settings), which is what these tools are asked
  for. `list_namespaces` now keeps the full reply too: the summary dropped
  `full_path`, `path`, and `kind`, which callers pass on as `project_id` or
  `group_id`. Passing `summary: true` still summarizes
  ([#963](https://github.com/zereight/gitlab-mcp/issues/963)).

### Changed

- A unit test now fails when a list tool is not classified for the list
  summary (excluded, content on request, native, or summary-safe with the
  fields its summary must keep), so a new list tool gets a decision before it
  ships.
