# Stateless Mode — Multi-Pod Safe OAuth and Session

## The problem

By default, gitlab-mcp stores OAuth proxy state, DCR registrations, and MCP
session authentication in per-process memory. When deployed behind a
Kubernetes load balancer with multiple replicas (HPA), any request routed to
a different pod from the one that created the state will fail:

- `POST /register` on pod A, then `GET /authorize` on pod B ⇒ 400 "Unregistered redirect_uri"
- `GET /authorize` on pod A, then `GET /callback` on pod B (callback-proxy mode) ⇒ 400 "Unknown or expired state parameter"
- Init `/mcp` on pod A, then `tools/list` `/mcp` on pod B ⇒ 401 "Missing Private-Token…"

Header-based sticky sessions on `Mcp-Session-Id` do not solve this — Traefik's native stickiness is cookie-based, and the OAuth callback endpoints are browser-driven and carry no MCP header at all.

## The fix

**Stateless mode** encodes every piece of per-session state into the opaque
OAuth values themselves (`client_id`, OAuth `state`, OAuth `code`,
`Mcp-Session-Id`), authenticating and encrypting them with a shared
server-side secret. Any pod holding the secret can verify and reconstruct the
state from the wire value alone. No external store, no shared filesystem,
no sticky sessions.

## Enabling stateless mode

```bash
# 1. Generate a 32-byte secret
openssl rand -base64 32

# 2. Enable the mode and inject the secret
export OAUTH_STATELESS_MODE=true
export OAUTH_STATELESS_SECRET='<the value from step 1>'

# 3. Run the server as usual (STREAMABLE_HTTP + REMOTE_AUTHORIZATION or GITLAB_MCP_OAUTH)
```

In Kubernetes, mount `OAUTH_STATELESS_SECRET` from a Secret, identical across
all pods:

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: gitlab-mcp
          env:
            - name: OAUTH_STATELESS_MODE
              value: "true"
            - name: OAUTH_STATELESS_SECRET
              valueFrom:
                secretKeyRef:
                  name: gitlab-mcp-stateless
                  key: secret
            - name: STREAMABLE_HTTP
              value: "true"
            - name: GITLAB_MCP_OAUTH
              value: "true"
            # …other env
```

## Upgrading from 2.0.x

In v2.1.x, stateless Streamable HTTP deployments should use
`REMOTE_AUTHORIZATION=true`. The old `STREAMABLE_HTTP=true` +
static `GITLAB_PERSONAL_ACCESS_TOKEN` setup is rejected for this mode.

Pass the caller token through request headers instead.

## What stateless mode changes

| Surface                              | Legacy                         | Stateless                                        |
| ------------------------------------ | ------------------------------ | ------------------------------------------------ |
| DCR registration                     | `_clientCache` on pod          | Signed `client_id` (`v1.cid.…`)                  |
| Callback-proxy `/authorize` state    | `_pendingAuth` on pod          | Sealed `state` (`v1.ps.…`)                       |
| Callback-proxy `/callback` → `/token` | `_storedTokens` on pod         | Sealed proxy `code` (`v1.pc.…`)                  |
| `/mcp` session auth                  | `authBySession` map on pod     | Sealed `Mcp-Session-Id` (`v1.sid.…`), rotated per request |
| Per-session rate-limit counter       | `sessionRequestCounts` on pod  | **Disabled**; the per-client-IP `/mcp` limit still runs on each pod |
| `StreamableHTTPServerTransport`      | Reused per session on pod      | Fresh transport per request (always)             |

Cryptography:
- HMAC-SHA256 for values whose payload is non-confidential (DCR is public by definition).
- AES-256-GCM for values whose payload includes secrets (proxy PKCE verifier, bearer tokens).
- Per-purpose subkeys derived with HKDF-SHA256 from the master secret so a
  token minted for one purpose cannot be verified as another.

## Configuration reference

| Env var                                   | Default                        | Meaning                                                |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| `OAUTH_STATELESS_MODE`                    | `false`                        | Master switch. `true` enables stateless encodings.     |
| `OAUTH_STATELESS_SECRET`                  | —                              | Required when mode=true. Base64url-encoded ≥32 bytes.  |
| `OAUTH_STATELESS_SECRET_PREVIOUS`         | —                              | Optional. Accepted on reads only, for rotation.        |
| `OAUTH_STATELESS_CLIENT_TTL_SECONDS`      | `86400`                        | Max age for a signed `client_id`.                      |
| `OAUTH_STATELESS_PENDING_TTL_SECONDS`     | `600`                          | Max age for a sealed OAuth `state`.                    |
| `OAUTH_STATELESS_STORED_TTL_SECONDS`      | `120`                          | Max age for a sealed proxy `code`.                     |
| `OAUTH_STATELESS_SESSION_TTL_SECONDS`     | inherits `SESSION_TIMEOUT_SECONDS` | Inactivity timeout for a sealed `Mcp-Session-Id`.  |

CLI arguments take the same names with dashes (e.g. `--oauth-stateless-mode=true`).

None of these TTLs makes users authorize in GitLab again. For that, see
[Session TTL and GitLab re-authorization](#session-ttl-and-gitlab-re-authorization).

## Secret rotation

1. Generate `S_new`.
2. Deploy with `OAUTH_STATELESS_SECRET=S_new` and `OAUTH_STATELESS_SECRET_PREVIOUS=S_old`.
3. New tokens are minted under `S_new`. Tokens minted under `S_old` still verify.
4. After `max(TTL)` (default: 24 h), redeploy without `OAUTH_STATELESS_SECRET_PREVIOUS`.

On suspected compromise, rotate `OAUTH_STATELESS_SECRET` without setting
`_PREVIOUS` — this immediately invalidates every outstanding client_id,
session, pending auth, and proxy code. Clients must re-register and
re-authenticate.

## Security model

| Value                 | Attacker gain on theft                                                                                      | Mitigation                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `client_id`           | Public by design. No new capability beyond registering their own client.                                     | None needed.                                                                                                 |
| OAuth `state`         | Useless alone — GitLab's auth code is single-use.                                                            | Short TTL (10 min).                                                                                          |
| Proxy `code`          | Contains GitLab access token.                                                                                | Short TTL (2 min) + PKCE `code_verifier` check at `/token` time.                                             |
| `Mcp-Session-Id`      | Equivalent to presenting the bearer token.                                                                   | TLS mandatory. Log redaction recommended. Inactivity-window TTL (default 1 h).                                |
| `OAUTH_STATELESS_SECRET` | Total forgery: can mint client_ids, sessions, pending auths, proxy codes; can decrypt any sealed value. | Treat as a top-tier bearer secret. K8s Secret with access audit; rotate on suspected compromise.            |

### Replay considerations

- **OAuth `state`** — replay is tolerated. A replayed state without a matching
  valid GitLab auth code yields nothing; GitLab's code is single-use.
- **Proxy `code`** — replay is defeated by PKCE, a short TTL (default 120s),
  and a per-pod TTL-bound cache of code hashes (pending while validating,
  consumed after a successful `/token`). Failed client/PKCE checks release the
  reservation so the legitimate client can retry. Entries are never LRU-evicted
  before their TTL; when the cache is full the server fails closed.
- **`Mcp-Session-Id`** — replay is equivalent to presenting the stolen bearer
  token, which is a known threat model at the HTTP layer. TLS and operator
  discipline on log redaction protect this surface.

One-time-use semantics cannot be enforced *across pods* in stateless mode
without a shared store. This is an explicit design trade-off: the plan chose
"no external dependency" over "strict cross-pod one-time use" because the
PKCE + short TTL + per-pod replay cache combination provides equivalent
practical security.

## Operational notes

### Rate limiting

Stateless mode disables only the **per-session** counter
(`sessionRequestCounts`): a per-pod counter keyed by a sealed session id would
yield a loose global bound proportional to the replica count. The
**per-client-IP** `express-rate-limit` middleware on `GET`, `POST`, and
`DELETE /mcp` still runs in stateless mode, with the same
[`MAX_REQUESTS_PER_MINUTE`](environment-variables.md#max_requests_per_minute)
value, the same fixed 60-second window, and a separate counter on each pod.
A `GET /mcp` that reaches the stateless check is counted before it is
answered `405`. Operators who need a strict
global rate limit should apply it at the ingress (Traefik, Nginx, Envoy) or
WAF level, which already see all traffic before it reaches any pod.

### Transport object affinity

`StreamableHTTPServerTransport` owns the HTTP connection for the current
request. Server-initiated notifications (e.g.
`notifications/tools/list_changed`) are sent on that connection. In stateless
mode, a new transport is created per request — so any pending notification
queued for a previous request but not yet sent will be dropped if the next
request lands on a different pod.

In practice this is rarely a problem because:
- MCP clients poll frequently enough that missed notifications are
  self-correcting.
- Most tool calls complete within a single request/response cycle.

Deployments that require guaranteed notification delivery should use
cookie-based stickiness at the ingress. Stateless mode does not preclude
this; the two can be combined.

### Session lifetime and sid rotation

The sealed `Mcp-Session-Id` rotates on every authenticated `/mcp` request.
Each response carries a new sid whose embedded `iat` is the current server
time, and clients are expected to adopt the latest value from each
response — this is the standard MCP SDK pattern and the SDK handles it
transparently.

Because `iat` advances on every request,
`OAUTH_STATELESS_SESSION_TTL_SECONDS` behaves as an **inactivity**
timeout rather than an absolute-age cap. A continuously-used session
persists indefinitely; a session is only rejected when no traffic has
arrived for longer than the configured TTL. This matches the legacy
stateful `setAuthTimeout` semantics.

When a client presents a sid that fails to open (expired past the
inactivity window, tampered, or sealed under a different key), the
server responds with `404 Session not found` — the standard MCP
Streamable HTTP signal meaning "session ended, re-initialize." SDK
clients handle this transparently by starting a fresh `initialize`
handshake. Clients that still have live credentials (Private-Token,
JOB-TOKEN, Authorization, or OAuth bearer) may also recover by
re-sending with both the stale sid and the live header; live auth
takes priority and a new sid is minted in the response.

A `401 Authentication required` is only returned when the request
carries neither a sid nor any live auth header — i.e. a genuinely
unauthenticated caller.

#### sid-only follow-ups under `GITLAB_MCP_OAUTH`

Under `GITLAB_MCP_OAUTH=true` + stateless, clients can issue sid-only
follow-up requests across pods without re-sending the OAuth bearer
token. The sealed `Mcp-Session-Id` carries the token (sealed with
the shared `OAUTH_STATELESS_SECRET`); the server opens it on each
request and uses the embedded token to authenticate. This is the
headline multi-pod behaviour of stateless mode: pod A initializes
the session with `Authorization: Bearer …`, and any other pod B can
serve a subsequent `POST /mcp` carrying only the sid.

When `GITLAB_OAUTH_ALLOWED_GROUPS` is set, the sealed token is checked
against the allowed groups on every sid-only request as well (cached
per token for 5 minutes in each pod), and a sid carrying a `JOB-TOKEN`
is rejected with `403`.

The bearer middleware detects this case by checking for an
`Mcp-Session-Id` header in the absence of an `Authorization` header
and lets the stateless handler open the sid. If an `Authorization`
header IS present alongside the sid, normal bearer validation still
runs — so refreshed OAuth tokens are validated, and malformed /
expired sids without an `Authorization` header still reach the
handler and get `404 Session not found` rather than being masked
by a `401`.

#### Session TTL and GitLab re-authorization

`OAUTH_STATELESS_SESSION_TTL_SECONDS` limits how long a sid stays usable
without traffic. It does not make users authorize in GitLab again: after the
sid expires the client re-initializes with its access token, and when the
access token expires the client renews it with its refresh token. Neither step
opens the browser.

To require a new browser authorization, set `OAUTH_DISABLE_REFRESH_TOKEN=true`
(see [Environment Variables](environment-variables.md#oauth_disable_refresh_token)).
`POST /token` then returns no `refresh_token` and rejects the refresh grant with
`invalid_grant`. Users re-authorize when the GitLab access token expires
(`expires_in`, 2 hours on GitLab), whatever the session TTL is:

```text
browser authorization ──> access token (expires_in), no refresh_token
        │
sid expires (session TTL) ──> 404 ──> re-initialize with the same token, no prompt
        │
access token expires ──> 401 on /mcp ──> browser authorization again
```

A session TTL longer than the token lifetime does not delay the prompt, and a
shorter one only adds silent re-initializations.

The flag is enforced only at this server's `/token`, with or without stateless
mode. It is a re-authorization policy for standard MCP clients, not a security
boundary. These cases get around it, because the client calls GitLab's
`/oauth/token` directly and this server accepts the access tokens it gets back:

- Refresh tokens that GitLab issued before the flag was turned on stay valid at
  GitLab until they are revoked under **User Settings → Applications →
  Authorized applications → Revoke**. The flag only rejects them when they are
  sent to this server, and clients start a new authorization only if they
  discard their stored tokens on `invalid_grant` (the MCP TypeScript SDK does).
- Without `GITLAB_OAUTH_CALLBACK_PROXY=true` (passthrough), the client holds
  the PKCE verifier and receives the GitLab code itself, so it can get a
  refresh token from GitLab on every authorization. In callback proxy mode an
  MCP client that follows this server's flow never gets a GitLab refresh token.
- In every mode the GitLab application is public, so a signed-in user can run
  their own PKCE flow against it and redeem the code at GitLab. See
  [What the flag cannot enforce](environment-variables.md#what-the-flag-cannot-enforce).

A sid-only request skips the bearer check (`/oauth/token/info`). After the
sealed token expires, a client that sends only the sid gets GitLab `401` errors
in tool results until it sends a Bearer token again (for example after a `404`
or a restart). MCP SDK clients send the Bearer token on every request, so they get
the `401` from `/mcp` and re-authorize right away.

#### `DELETE /mcp` authentication

In `GITLAB_MCP_OAUTH=true` mode, `DELETE /mcp` is now gated by the
same bearer middleware as `POST /mcp`: a caller must present a
bearer token, a valid `Private-Token` / `JOB-TOKEN`, or a sealed
`Mcp-Session-Id`. Previously `DELETE /mcp` had no auth middleware,
which was a gap in the security posture for explicit session
termination. In non-OAuth modes the behaviour is unchanged.

### Metrics

The `/metrics` endpoint reports Prometheus per-instance counters. JSON metrics
are available at `/metrics.json`. In stateless mode, `activeSessions` and
`authenticatedSessions` become less meaningful (each request is its own session
from the pod's perspective) — scale your dashboards accordingly.

### Interop with legacy clients

Legacy (non-stateless) client_ids, states, and session_ids that still exist
in circulation continue to be routed to the legacy code path on a best-
effort basis. However, under multi-pod deployments they will fail for the
same reasons they always did. New registrations and sessions under stateless
mode always use the new format.

## When NOT to use stateless mode

- Single-replica deployments. Legacy mode is cheaper and has the same
  functional properties at one pod.
- Deployments that require strict per-session rate limiting inside the app
  (unless you can move the limiter upstream). The per-client-IP `/mcp` limit
  still applies, counted per pod.
- Deployments that require absolute one-time-use enforcement for OAuth state
  and codes (unusual; PKCE + TTL is normally sufficient).

## Related documents

- [OAuth Callback Proxy](../auth/oauth-callback-proxy.md) — the mode that benefits
  most from stateless encodings.
- [Environment Variables](environment-variables.md) — the full reference.
- [OAuth Setup](../auth/oauth-setup.md) — how to configure the upstream GitLab
  OAuth application.
