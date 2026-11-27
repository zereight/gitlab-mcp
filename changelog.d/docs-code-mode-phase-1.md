### Changed

- `help` with topic `pipelines`, the bundled skill, and its pipelines reference
  now recommend `wait_for_pipeline` and `wait_for_job` instead of calling
  `list_pipelines`, `get_pipeline`, or `list_pipeline_jobs` in a loop.
- `help` with topic `token-saving`, the bundled skill, the environment variable
  reference, and the README FAQ now recommend `GITLAB_MCP_LIST_SUMMARY_DEFAULT=true`
  (`--list-summary-default`) and `GITLAB_MCP_COMPACT_TOOLS` (`--compact-tools`)
  as opt-in settings that shrink MCP replies. Both stay off by default.
