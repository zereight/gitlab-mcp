### Fixed

- `get_merge_request_conflicts` called a REST endpoint
  (`GET /projects/:id/merge_requests/:iid/conflicts`) that does not exist on
  GitLab's REST API v4, so every call failed with a 404. It now queries
  GitLab's GraphQL API for `conflicts`, and for `conflictStatus`/
  `conflictFiles` where the instance supports them (GitLab 19.4+), falling
  back to just `conflicts` on older instances. The response shape changes
  from an unreachable REST payload to a JSON object: `has_conflicts` is
  always present, and `conflict_status`/`conflict_files` are included only
  when the instance supports them.
