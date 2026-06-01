# Meta & GraphQL

Tools the MCP exposes that aren't tied to a specific GitLab feature group — server diagnostics and the GraphQL escape hatch.

## Tools in this group

- [`execute_graphql`](#execute_graphql) — ✏️ Writes
- [`discover_tools`](#discover_tools) — 📖 Read-only

---

### `execute_graphql`

*✏️ Writes*

Execute a GitLab GraphQL query

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `query` | string | ✓ | GraphQL query string |
| `variables` | object |  | Variables object for the GraphQL query |

### `discover_tools`

*📖 Read-only*

Discover and activate additional tool categories for this session. Available categories: merge_requests, issues, repositories, branches, projects, labels, ci, groups, pipelines, milestones, wiki, releases, tags, users, workitems, webhooks, search, variables, dependency_proxy. Already-active categories are listed in the response.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `category` | string |  | Toolset category to activate (e.g. 'pipelines', 'wiki'). Omit to list available categories. |
