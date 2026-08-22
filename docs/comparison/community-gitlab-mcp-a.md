# GitLab MCP A — Community CQRS-Style Servers

This document compares `@zereight/mcp-gitlab` with **GitLab MCP A**: a label for community GitLab
MCP servers that use a **CQRS-style tool model** — grouped read tools (`browse_*`) and write tools
(`manage_*`) with an `action` parameter instead of one tool per API endpoint.

We use a neutral name so the comparison stays about architecture and trade-offs, not a specific
vendor or fork.

## At a glance

| Dimension | @zereight/mcp-gitlab | GitLab MCP A (CQRS-style) |
|-----------|----------------------|---------------------------|
| Tool count (listed) | ~217 granular tools | ~50–60 grouped tools |
| Operations | 1 tool ≈ 1 API call | 1 tool × many `action` values |
| Token control | `discover_tools`, `GITLAB_TOOLSETS`, `GITLAB_TOOLS` | Smaller default tool list |
| Tool discovery | Explicit names (`get_merge_request`, `list_pipelines`, …) | Category + action (`browse_merge_requests`, …) |
| MR code review | 2-step batched diff workflow | Often single browse tool per domain |
| Multi-instance | [Design in progress](../configuration/multi-instance-design.md) | Often built-in (env/YAML) |
| Connection resilience | Basic health check | Often state machine + reconnect |
| GitLab version awareness | `health_check` reports version | Often filters schemas by version/tier |
| Remote / OAuth | Deep (stateless HPA, callback proxy, remote auth) | Varies |
| Agent Skill | Yes (`skills/gitlab-mcp/`) | Rare |
| Node.js | >=18 | Often >=24 |
| License | MIT | Varies |

## Tool model

### @zereight/mcp-gitlab — granular tools

Each major GitLab operation is a named MCP tool. Agents can call `get_merge_request` or
`list_pipeline_jobs` directly when they know the tool name.

Token budget is managed without collapsing the model:

1. **Default toolsets** — only expose categories you need via `GITLAB_TOOLSETS`
2. **`discover_tools`** — activate categories at runtime; server sends `list_changed`
3. **Agent Skill** — workflow guidance without loading every tool description

### GitLab MCP A — CQRS grouping

Tools are grouped by domain (projects, merge requests, pipelines, …). Each tool accepts an
`action` argument (`list`, `get`, `create`, …). Fewer tool names appear in `tools/list`, which
can reduce context size for clients that load all schemas up front.

Trade-off: agents must learn the action vocabulary inside each group instead of scanning
flat tool names.

## When @zereight/mcp-gitlab fits better

- **MR review workflows** — changed-files list, then batched per-file diffs (token-efficient
  without CQRS)
- **Agent-first setups** — Skill + `discover_tools` cover “start small, grow on demand”
- **Broad API surface** — dependency proxy, vulnerability triage, work items, draft notes, etc.
- **Deployment flexibility** — stdio / SSE / Streamable HTTP, remote auth, stateless OAuth
- **Lower Node requirement** — Node 18+

## When GitLab MCP A fits better

- **Multi-instance today** — several self-hosted GitLab URLs in one MCP process (we are designing
  this; see [multi-instance design](../configuration/multi-instance-design.md))
- **Strict tool list cap** — hard limit on `tools/list` size without runtime discovery
- **Version/tier schema filtering** — hide tools unsupported on your GitLab tier automatically
- **Platform-team UX** — YAML config files, VS Code install badges, generated tool catalogs

## Feature overlap (observable)

Both approaches typically cover:

- Projects, groups, merge requests, issues, pipelines
- PAT and OAuth authentication
- Self-hosted GitLab (`GITLAB_API_URL`)
- Read-only or permission-restricted modes

Differentiators to verify per server:

| Area | @zereight/mcp-gitlab | Check on GitLab MCP A |
|------|----------------------|------------------------|
| MR batched diff review | Yes | Varies |
| `discover_tools` runtime activation | Yes | Uncommon |
| Stateless OAuth / HPA | Yes | Varies |
| Runners / registry / audit APIs | Partial / issue-driven | Often broader in enterprise variants |
| Multi-instance | Planned | Often yes |

## Migration notes

If you are evaluating a switch in either direction:

1. Compare **your actual prompts** — MR review and pipeline debug are the most sensitive flows
2. Map **toolsets** — `GITLAB_TOOLSETS=all` on our side vs CQRS `browse_*` groups on theirs
3. Check **auth** — PAT-only multi-instance is simpler; OAuth multi-instance needs extra design
4. Run **`health_check`** on both against the same GitLab instance

## See also

- [Comparison overview](index.md)
- [discover_tools](../configuration/discover-tools.md) (coming soon)
- [Multi-instance design](../configuration/multi-instance-design.md)
- [VS Code setup](../clients/vscode.md)
