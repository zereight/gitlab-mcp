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

## What stateless mode changes

| Surface                              | Legacy                         | Stateless                                        |
| ------------------------------------ | ------------------------------ | ------------------------------------------------ |
| DCR registration                     | `_clientCache` on pod          | Signed `client_id` (`v1.cid.…`)                  |
| Callback-proxy `/authorize` state    | `_pendingAuth` on pod          | Sealed `state` (`v1.ps.…`)                       |
| Callback-proxy `/callback` → `/token` | `_storedTokens` on pod         | Sealed proxy `code` (`v1.pc.…`)                  |
| `/mcp` session auth                  | `authBySession` map on pod     | Sealed `Mcp-Session-Id` (`v1.sid.…`), rotated per request |
| Per-session rate-limit counter       | `sessionRequestCounts` on pod  | **Disabled** (rate-limit at Traefik/WAF instead) |
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
| `OAUTH_STATELESS_STORED_TTL_SECONDS`      | `600`                          | Max age for a sealed proxy `code`.                     |
| `OAUTH_STATELESS_SESSION_TTL_SECONDS`     | inherits `SESSION_TIMEOUT_SECONDS` | Inactivity timeout for a sealed `Mcp-Session-Id`.  |

CLI arguments take the same names with dashes (e.g. `--oauth-stateless-mode=true`).

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
| Proxy `code`          | Contains GitLab access token.                                                                                | Short TTL (10 min) + PKCE `code_verifier` check at `/token` time.                                            |
| `Mcp-Session-Id`      | Equivalent to presenting the bearer token.                                                                   | TLS mandatory. Log redaction recommended. Inactivity-window TTL (default 1 h).                                |
| `OAUTH_STATELESS_SECRET` | Total forgery: can mint client_ids, sessions, pending auths, proxy codes; can decrypt any sealed value. | Treat as a top-tier bearer secret. K8s Secret with access audit; rotate on suspected compromise.            |

### Replay considerations

- **OAuth `state`** — replay is tolerated. A replayed state without a matching
  valid GitLab auth code yields nothing; GitLab's code is single-use.
- **Proxy `code`** — replay is defeated by the existing PKCE check. An
  attacker replaying the code without the matching `code_verifier` fails at
  `/token`. Combined with the 10 minute TTL.
- **`Mcp-Session-Id`** — replay is equivalent to presenting the stolen bearer
  token, which is a known threat model at the HTTP layer. TLS and operator
  discipline on log redaction protect this surface.

One-time-use semantics cannot be enforced in stateless mode without a shared
store. This is an explicit design trade-off: the plan chose "no external
dependency" over "strict one-time use" because the PKCE + TTL combination
provides equivalent practical security.

## Operational notes

### Rate limiting

Rate limiting is **disabled** in stateless mode — per-pod counters would
yield a loose global bound proportional to the replica count. Operators who
need a strict global rate limit should apply it at the ingress (Traefik,
Nginx, Envoy) or WAF level, which already see all traffic before it reaches
any pod.

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

### Metrics

The `/metrics` endpoint reports per-instance counters. In stateless mode,
`activeSessions` and `authenticatedSessions` become less meaningful (each
request is its own session from the pod's perspective) — scale your
dashboards accordingly.

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
  (unless you can move the limiter upstream).
- Deployments that require absolute one-time-use enforcement for OAuth state
  and codes (unusual; PKCE + TTL is normally sufficient).

## Related documents

- [OAuth Callback Proxy](./oauth-callback-proxy.md) — the mode that benefits
  most from stateless encodings.
- [Environment Variables](./environment-variables.md) — the full reference.
- [OAuth Setup](./oauth-setup.md) — how to configure the upstream GitLab
  OAuth application.
