### Fixed

- The `list_issues` `milestone` description now says it is an exact milestone
  title, not an ID, and points milestone IDs to `get_milestone_issue` and
  `get_group_milestone_issue`. The `milestone_id` of the project and group
  milestone tools now says it is the milestone `id`, not the `iid` shown in its
  web URL. Only descriptions change; requests are unchanged
  ([#996](https://github.com/zereight/gitlab-mcp/issues/996))
