### Added

- `reorder_issue` in the `issues` toolset moves an issue within the manual sort order that issue boards show, through `PUT /projects/:id/issues/:issue_iid/reorder`. `move_after_id` and `move_before_id` take the neighbor issue's global `id` (not its `iid`); at least one is required, and a call with neither is rejected as an argument error before GitLab is called. It returns the reordered issue. It is a write tool: `GITLAB_PERMISSION_MODE=readonly` hides it, `modify` and `full` allow it ([#958](https://github.com/zereight/gitlab-mcp/issues/958))
