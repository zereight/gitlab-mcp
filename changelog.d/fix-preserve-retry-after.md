### Fixed

- Tool errors that come from a GitLab HTTP response now carry that response's
  HTTP status, and GitLab's `Retry-After` header when one was sent, as
  out-of-band metadata in `_meta["io.github.zereight.gitlab-mcp/http-error"]`
  on the `isError` result. The error text in `content` is unchanged, and error
  results never set `structuredContent`, so clients that prefer structured
  output keep seeing the GitLab error message. A client that honors
  `Retry-After` no longer has to parse the error text or guess the retry delay
  on a 429 ([#935](https://github.com/zereight/gitlab-mcp/issues/935))
