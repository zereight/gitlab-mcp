### Security

- With masking enabled (`GITLAB_MASKING_ENABLED=true` / `--masking-enabled`),
  the value of a GitLab CI/CD variable that GitLab flags `masked` or `hidden`
  is now replaced with `[Masked CI variable value]` in tool results, including
  `list_*_variables`, `get_*_variable`, `create_*_variable`, and
  `update_*_variable` for projects and groups. Before, such values were returned
  in plain text unless they matched a built-in pattern. The same applies to such
  records in plain-text output (for example job logs), error messages, and JSON
  embedded in other text. With masking disabled, nothing changes.
