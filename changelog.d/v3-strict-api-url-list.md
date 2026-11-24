### Breaking changes

- `GITLAB_API_URL` and `--api-url` no longer guess where a comma-separated list
  splits when a comma may be inside a username or password. A value such as
  `https://alice:123,https:word@host`, which v2 split into the URLs
  `https://alice:123` (host `alice`) and `https:word@host`, now stops the MCP
  server, the human CLI (`tool`, `doctor`, `setup`, and the curated commands),
  and `auth` at startup with
  `GITLAB_API_URL comma 1 of 1 may be inside a username or password, ...`. The
  error names only comma positions, never the value. A single URL with a literal
  comma in its password (`https://alice:p,w@host`) is refused too. Write a comma
  inside a username or password as `%2C`, or remove the username and password,
  which requests do not use. Lists without userinfo, with ports or paths, or
  with `%2C` in userinfo work as before, except a port before a later `@` even
  in a path (`https://a.example:443,https://b.example/team@docs`)
  ([#876](https://github.com/zereight/gitlab-mcp/issues/876))

### Fixed

- `doctor` no longer prints part of a password as the API URL, or probes it with
  `--probe`, when `GITLAB_API_URL` fails validation; the `api_url` check shows
  the validation error instead
  ([#876](https://github.com/zereight/gitlab-mcp/issues/876))
- `setup` no longer prints or writes an ambiguous `GITLAB_API_URL` or `--api-url`
  into a Cursor or Claude snippet; it exits `2` with the same position-only
  error as the other entry points
  ([#876](https://github.com/zereight/gitlab-mcp/issues/876))
