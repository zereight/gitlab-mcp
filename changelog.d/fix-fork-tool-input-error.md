### Fixed

- `fork_repository` with an empty `project_id` and no `GITLAB_PROJECT_ID` now
  returns an `isError` tool result with a `Next:` hint, like the other
  argument errors from #1029. Before, its own catch turned the error into a
  normal result without `isError`, with the text prefixed by
  `Failed to fork repository:`. The hint tells you to pass `project_id`. It
  does not suggest setting `GITLAB_PROJECT_ID`, because `fork_repository` is
  rejected when `GITLAB_PROJECT_ID` or a project allowlist is set. This is the
  only input error the fork handler can reach, since those setups are rejected
  before the project is resolved. GitLab HTTP and transport failures keep their
  current shape.
