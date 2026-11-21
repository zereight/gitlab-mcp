### Breaking changes

- `GITLAB_API_URL` and `--api-url` no longer guess where a comma-separated list
  splits when a comma may be inside a username or password. A value such as
  `https://alice:123,https:word@host`, which v2 split into the URLs
  `https://alice:123` (host `alice`) and `https:word@host`, now stops the MCP
  server, the human CLI, and `auth` at startup with
  `GITLAB_API_URL comma 1 of 1 may be inside a username or password, ...`. The
  error names only comma positions, never the value. A single URL with a literal
  comma in its password (`https://alice:p,w@host`) is refused too. Write a comma
  inside a username or password as `%2C`, or remove the username and password,
  which requests do not use. Lists without userinfo, with ports or paths, or
  with `%2C` in userinfo work as before
  ([#876](https://github.com/zereight/gitlab-mcp/issues/876))

### Fixed

- `doctor` no longer prints part of a password as the API URL, or probes it with
  `--probe`, when `GITLAB_API_URL` fails validation; the `api_url` check shows
  the validation error instead
  ([#876](https://github.com/zereight/gitlab-mcp/issues/876))
