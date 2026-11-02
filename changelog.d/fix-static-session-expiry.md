### Breaking changes

- Streamable HTTP sessions in server-side token mode (no `REMOTE_AUTHORIZATION`,
  no `GITLAB_MCP_OAUTH`) now expire after `SESSION_TIMEOUT_SECONDS` (default
  `3600`) of inactivity by default, as they already did in the per-session auth
  modes. A request to an expired session gets `404`, and the client must
  re-initialize, as the Streamable HTTP spec requires. Raise
  `SESSION_TIMEOUT_SECONDS` (up to `86400`) if your clients keep sessions idle
  for longer.

### Changed

- In server-side token mode, `GET /mcp` now pauses the inactivity timer while
  the stream is open and re-arms it when the stream closes, and every
  `POST /mcp` resets it, the same as in the per-session auth modes. In every
  mode, a second `GET /mcp` rejected with `409` while a stream is open no longer
  restarts the timer.

### Fixed

- Streamable HTTP sessions in server-side token mode were only released by
  `DELETE /mcp`. Clients that disconnected without it kept their slot until
  `MAX_SESSIONS` was reached, and from then on every new client got `503`
  ([#975](https://github.com/zereight/gitlab-mcp/issues/975)).
