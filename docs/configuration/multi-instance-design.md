# Multi-Instance GitLab — Design Spike

**Status**: Design spike (not implemented)  
**Goal**: Let one MCP server process talk to multiple GitLab instances (e.g. gitlab.com +
self-hosted) without CQRS-style YAML compatibility requirements.

## Problem

Today a single server process binds to one `GITLAB_API_URL` and one credential set. Enterprise
users with several GitLab instances must run multiple MCP server entries or pick a CQRS-style
community server that already supports multi-instance config.

## Non-goals (Phase 1)

- OAuth across multiple instances (defer to Phase 2)
- YAML config compatibility with other community servers
- Automatic `git remote` discovery (separate P2 spike; security review required)
- Breaking changes to existing single-instance setups

## Proposed configuration

### `GITLAB_INSTANCES` (JSON)

Single env var, array of instance profiles. Phase 1 is **PAT-only**.

```json
[
  {
    "id": "gitlab-com",
    "apiUrl": "https://gitlab.com/api/v4",
    "token": "glpat-xxxxxxxx"
  },
  {
    "id": "corp",
    "apiUrl": "https://gitlab.corp.example.com/api/v4",
    "tokenEnv": "GITLAB_CORP_PAT"
  }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable slug used in tool calls and logs |
| `apiUrl` | yes | GitLab API base (`…/api/v4`) |
| `token` | one of | Inline PAT (discouraged in committed config) |
| `tokenEnv` | one of | Env var name holding PAT (preferred) |
| `default` | no | Exactly one profile may be default when omitted |

Rules:

- If `GITLAB_INSTANCES` is unset, behavior is unchanged (single `GITLAB_API_URL` mode).
- If set, `GITLAB_API_URL` / `GITLAB_PERSONAL_ACCESS_TOKEN` may define the default profile or
  be ignored when `default` is set on an entry.
- Invalid JSON → fail fast at startup with a clear error.

### Instance selection in tool calls

**Option A (recommended)** — optional `instance` parameter on every tool:

```json
{
  "project_id": "group/project",
  "instance": "corp"
}
```

When omitted, use the default profile.

**Option B** — MCP session header / env `GITLAB_ACTIVE_INSTANCE`:

- Better for clients that cannot add per-call fields
- Harder for multi-instance agents in one conversation

**Spike decision**: Option A for explicit agent control; Option B as a session default fallback.

### Remote auth / Streamable HTTP

For `REMOTE_AUTHORIZATION` and OAuth sessions, instance may be chosen via:

- `X-GitLab-Instance: corp` request header, or
- `instance` query param on Streamable HTTP tool calls (align with dynamic API URL patterns)

OAuth multi-instance: **Phase 2** — each profile may need its own OAuth app and token store key
`(instanceId, userId)`.

## Runtime architecture (sketch)

```text
┌─────────────────────────────────────────────────────────┐
│ MCP Server process                                       │
│  ┌─────────────────┐    ┌──────────────────────────┐  │
│  │ InstanceRegistry │───>│ GitLabApiClient per id    │  │
│  │ (from env JSON)  │    │ (pool, rate limit, token) │  │
│  └────────┬────────┘    └──────────────────────────┘  │
│           │ resolve(instance?, default)                  │
│  ┌────────▼────────┐                                     │
│  │ Tool handlers    │  instance param → client lookup   │
│  └─────────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

### `health_check` changes

Return per-instance status when multi-instance mode is active:

```json
{
  "status": "ok",
  "instances": [
    { "id": "gitlab-com", "reachable": true, "version": "18.2.0" },
    { "id": "corp", "reachable": false, "error": "connection refused" }
  ]
}
```

Single-instance mode keeps the current response shape.

## Connection resilience (Phase 1.5)

Not full XState; minimal viable behavior:

1. Mark instance `degraded` after N consecutive failures
2. `health_check` reports degraded; other tools return structured error with `instance` id
3. Background probe every 60s to clear degraded state
4. Server process stays up (disconnected mode per instance, not global crash)

## Security

| Risk | Mitigation |
|------|------------|
| Token leakage in logs | Never log tokens; log `instance` id only |
| Cross-instance token mix-up | Registry key = `id`; immutable after load |
| SSRF via `apiUrl` | Allowlist optional `GITLAB_INSTANCE_ALLOW_HOSTS` |
| Env JSON in process list | Prefer `tokenEnv` over inline `token` |

## Implementation phases

| Phase | Scope | Estimate |
|-------|-------|----------|
| **0** | This design doc + schema for `GITLAB_INSTANCES` | Done (spike) |
| **1** | PAT multi-instance, `instance` param, `health_check` | 1–2 weeks |
| **1.5** | Per-instance degraded state + probe | 3–5 days |
| **2** | OAuth per instance, remote auth header | 2+ weeks |
| **3** | `git remote` auto-discovery (opt-in) | TBD |

## Open questions

1. Should `whoami` require `instance` or return all profiles?
2. Rate limiting: per-instance buckets vs global?
3. Tool schema: add `instance` to Zod once globally or code-gen per tool?
4. Docs: one MCP config block with `GITLAB_INSTANCES` vs multiple stdio servers?

## Recommendation

**Proceed to Phase 1 POC** with PAT-only `GITLAB_INSTANCES`, optional `instance` tool parameter,
and extended `health_check`. Defer OAuth multi-instance and YAML import.

## See also

- [Environment variables](environment-variables.md)
- [Custom agents and multiple PAT](../auth/custom-agent-multiple-pat.md)
- [GitLab MCP A comparison](../comparison/community-gitlab-mcp-a.md)
