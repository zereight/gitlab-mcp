# GitLab Orbit

Query the Orbit SDLC knowledge graph (Beta; Premium/Ultimate). Graph queries consume GitLab credits; schema, status, and tool listing are free.

!!! note "Feature toggle"
    Opt-in. Prefer `discover_tools` at runtime, or persist with `GITLAB_TOOLSETS=orbit` / `GITLAB_TOOLS=`. Avoid `GITLAB_TOOLSETS=all` (loads ~all schemas into tools/list).

## Tools in this group

- [`orbit_query`](#orbit_query) — 📖 Read-only
- [`orbit_get_schema`](#orbit_get_schema) — 📖 Read-only
- [`orbit_get_status`](#orbit_get_status) — 📖 Read-only
- [`orbit_list_tools`](#orbit_list_tools) — 📖 Read-only

---

### `orbit_query`

*📖 Read-only*

Execute a GitLab Orbit graph query over the indexed SDLC knowledge graph. Answer cross-project relationship questions in one call. Premium/Ultimate; each call consumes GitLab credits. Use `orbit_get_schema` first when types are unknown.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `query` | object | ✓ | GitLab Orbit query DSL object (see the Orbit query-language reference for node/edge types and operators) |
| `format` | enum (`raw` \| `llm`) |  | Response format: 'raw' for structured JSON, 'llm' for compact agent-optimized text (default) |

### `orbit_get_schema`

*📖 Read-only*

Fetch the current GitLab Orbit graph schema (node and edge types). List node and edge types for `orbit_query`. Read-only and free of credit charges.

**Parameters**

_No parameters._

### `orbit_get_status`

*📖 Read-only*

Check GitLab Orbit indexing status for the enabled scope. Check whether Orbit indexing has completed. Results reflect the last index cycle.

**Parameters**

_No parameters._

### `orbit_list_tools`

*📖 Read-only*

List the MCP tool definitions exposed by GitLab Orbit. List MCP tool definitions Orbit itself exposes. Use `orbit_query` to run graph queries.

**Parameters**

_No parameters._
