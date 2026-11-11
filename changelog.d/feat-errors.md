### Changed

- Missing, conflicting, or invalid arguments and lookups that find nothing now
  come back as `isError` tool results with a `Next:` hint. Before, these 27
  checks threw a JSON-RPC internal error (-32603), which the model may never
  see. This is the same change #954 made for group iterations. The old message
  is still the start of the text, so log searches keep matching, and the hint
  follows on its own line, for example
  `Group not found: my-group\nNext: check group_id (...)`. This covers:
  - a missing `project_id` when several projects are allowed or
    `GITLAB_PROJECT_ID` is not set;
  - `name` and `context` passed together to `create_commit_status`;
  - `update_dependency_proxy_settings` with nothing to change;
  - malformed vulnerability IDs;
  - `upload_markdown` with no file;
  - `download_attachment` file names containing `/` or `\`;
  - `create_snippet` with no files;
  - `update_issue_description_patch` with no SEARCH/REPLACE block;
  - unknown work item types;
  - projects, groups, merge requests, work items, labels, users, work item
    types, and vulnerabilities that GitLab's GraphQL API does not return.

  A client that read these failures from the JSON-RPC `error` must now read the
  tool result.
