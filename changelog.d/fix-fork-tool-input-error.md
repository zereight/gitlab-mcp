### Fixed

- `fork_repository` with an empty `project_id` and no `GITLAB_PROJECT_ID` now
  returns an `isError` tool result with the `Next:` hint, like the other
  argument errors from #1029. Before, its own catch turned the error into a
  normal result without `isError`, with the text prefixed by
  `Failed to fork repository:`. Other fork failures keep their current shape.
