# Meta & GraphQL

Tools the MCP exposes that aren't tied to a specific GitLab feature group — server diagnostics and the GraphQL escape hatch.

!!! note "Feature toggle"
    Mixed availability. `discover_tools` is always exposed (the server re-adds it after every toolset filter). `execute_graphql` is not part of any toolset — enable it explicitly with `GITLAB_TOOLS=execute_graphql`. Tools excluded from the list (toolset / `GITLAB_TOOLS` / `GITLAB_DENIED_TOOLS_REGEX`) are also rejected on direct calls; `GITLAB_TOOL_POLICY_HIDDEN` tools stay callable only while they are otherwise enabled (toolset / `GITLAB_TOOLS` / permission mode) and do not match `GITLAB_DENIED_TOOLS_REGEX`; hiding a tool does not enable it.

## Tools in this group

- [`execute_graphql`](#execute_graphql) — 📖✏️ Reads and writes
- [`discover_tools`](#discover_tools) — 📖 Read-only

---

### `execute_graphql`

*📖✏️ Reads and writes*

Execute a GitLab GraphQL query. Use only when no typed REST tool covers the operation. The query is sent directly and may include mutations.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `query` | string | ✓ | GraphQL query string |
| `variables` | object |  | Variables object for the GraphQL query |

### `discover_tools`

*📖 Read-only*

Discover and activate additional tool categories for this session. Available categories: core, merge_requests, issues, repositories, branches, projects, labels, ci, groups, pipelines, milestones, wiki, releases, tags, snippets, users, workitems, webhooks, search, variables, dependency_proxy, vulnerabilities, orbit. Already-active categories are listed in the response. Explicit-only toolsets are omitted; list them in GITLAB_TOOLSETS.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `category` | string |  | Toolset category to activate (e.g. 'pipelines', 'wiki'). Omit to list available categories. |
