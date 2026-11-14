### Added

- Opt-in NDJSON audit log of MCP tool calls for SIEM ingestion (`GITLAB_AUDIT_LOG`,
  `GITLAB_AUDIT_LOG_FILE` / `--audit-log`, `--audit-log-file`). Off by default.
  Each line is an allowlist of metadata (timestamp, transport, the accepted
  request auth method, tool, project/group ids, outcome, duration). Argument
  bodies, response
  bodies, tokens, and headers are never logged. This is a logging building
  block; retention and access control are the operator's responsibility.
