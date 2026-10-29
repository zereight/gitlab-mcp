### Fixed

- In callback proxy mode (`GITLAB_OAUTH_CALLBACK_PROXY=true`), `POST /token`
  with `grant_type=authorization_code` now answers HTTP 400 `invalid_grant`
  instead of 500 `server_error` when the proxy code is unknown, expired,
  already used, issued to another client, or redeemed with a different
  `redirect_uri` or a wrong PKCE `code_verifier`, and HTTP 400
  `invalid_request` when `code_verifier` is empty. MCP clients then restart
  authorization instead of treating the rejection as a server fault. "Exchange
  in progress" and "server busy" stay 500 `server_error`
  ([#940](https://github.com/zereight/gitlab-mcp/issues/940)).
- With `GITLAB_OAUTH_ALLOWED_GROUPS` set, the authorization code exchange for a
  user outside the allowed groups now fails with HTTP 400 `invalid_grant`
  instead of 500 `server_error`, as the refresh grant already did
  ([#940](https://github.com/zereight/gitlab-mcp/issues/940)).
