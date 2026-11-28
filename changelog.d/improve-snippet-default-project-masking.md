### Security

- Snippet tools called without `project_id` now apply the managed masking policy
  bound to the server's default project (`GITLAB_PROJECT_ID`, or the single allowed
  project). Before, that policy was skipped, so its keywords could reach the client
  unmasked, or the call failed with "does not cover this project-less tool".
