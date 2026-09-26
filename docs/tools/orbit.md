# GitLab Orbit

Query the Orbit SDLC knowledge graph (Beta; Premium/Ultimate). Graph queries consume GitLab credits; schema, status, and tool listing are free.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=orbit` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`orbit_query`](#orbit_query) — 📖 Read-only
- [`orbit_get_schema`](#orbit_get_schema) — 📖 Read-only
- [`orbit_get_status`](#orbit_get_status) — 📖 Read-only
- [`orbit_list_tools`](#orbit_list_tools) — 📖 Read-only

---

### `orbit_query`

*📖 Read-only*

Execute a GitLab Orbit graph query over the indexed SDLC knowledge graph. Use this to answer cross-project relationship questions (blast radius, file-to-MR history, dependency fans) in one call instead of chaining list/get tools; use `orbit_get_schema` first when the node/edge types are unknown. It is read-only but each call consumes GitLab credits, requires Premium/Ultimate on an Orbit-enabled scope, and returns the graph result or a query/permission error.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `query` | object | ✓ | GitLab Orbit query DSL object (see the Orbit query-language reference for node/edge types and operators) |
| `format` | enum (`raw` \| `llm`) |  | Response format: 'raw' for structured JSON, 'llm' for compact agent-optimized text (default) |

### `orbit_get_schema`

*📖 Read-only*

Fetch the current GitLab Orbit graph schema (node and edge types). Use this to learn the node and edge types available for `orbit_query` before writing a query; use `orbit_get_status` when the concern is index freshness rather than shape. It is read-only and free of credit charges, and returns the current graph schema or a permission error.

**Parameters**

_No parameters._

### `orbit_get_status`

*📖 Read-only*

Check GitLab Orbit indexing status for the enabled scope. Use this to check whether Orbit indexing has completed before trusting `orbit_query` results; results reflect the last index cycle, not real-time state. It is read-only and free of credit charges, and returns the indexing status or a permission error.

**Parameters**

_No parameters._

### `orbit_list_tools`

*📖 Read-only*

List the MCP tool definitions exposed by GitLab Orbit. Use this to see which MCP tool definitions Orbit itself exposes; use `orbit_query` to run graph queries directly. It is read-only and free of credit charges, and returns the tool definition list or a permission error.

**Parameters**

_No parameters._
