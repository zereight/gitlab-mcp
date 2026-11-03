# Meta & GraphQL

Tools the MCP exposes that aren't tied to a specific GitLab feature group — server diagnostics and the GraphQL escape hatch.

!!! note "Feature toggle"
    Mixed availability. `discover_tools` and `help` are always exposed (the server re-adds them after every toolset filter). `execute_graphql` is not part of any toolset — enable it explicitly with `GITLAB_TOOLS=execute_graphql`. Tools excluded from the list (toolset / `GITLAB_TOOLS` / `GITLAB_DENIED_TOOLS_REGEX`) are also rejected on direct calls; `GITLAB_TOOL_POLICY_HIDDEN` tools stay callable only while they are otherwise enabled (toolset / `GITLAB_TOOLS` / permission mode) and do not match `GITLAB_DENIED_TOOLS_REGEX`; hiding a tool does not enable it.

## Tools in this group

- [`execute_graphql`](#execute_graphql) — 📖✏️ Reads and writes
- [`discover_tools`](#discover_tools) — 📖 Read-only
- [`help`](#help) — 📖 Read-only

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

List or activate a toolset for this session. Omit category to list; pass one to enable. Prefer this over GITLAB_TOOLSETS=all (loads ~all schemas). Session-only; with OAUTH_STATELESS_MODE=true persist GITLAB_TOOLSETS instead. Categories: core, merge_requests, issues, repositories, branches, projects, labels, ci, groups, pipelines, milestones, wiki, releases, tags, snippets, users, workitems, webhooks, search, variables, dependency_proxy, vulnerabilities, orbit. Response lists already-active ones. api is explicit-only.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `category` | string |  | Toolset to activate (e.g. pipelines, wiki). Omit to list. Prefer a category over GITLAB_TOOLSETS=all. Session-only; persist GITLAB_TOOLSETS when OAUTH_STATELESS_MODE=true. |

### `help`

*📖 Read-only*

Return a short GitLab workflow guide. Omit topic for the overview and topic list. Topics: code-review, merge-requests, issues, pipelines, search, token-saving. Prefer discover_tools over GITLAB_TOOLSETS=all. With OAUTH_STATELESS_MODE=true persist GITLAB_TOOLSETS instead.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `topic` | enum (`overview` \| `code-review` \| `merge-requests` \| `issues` \| `pipelines` \| `search` \| `token-saving`) |  | Guide to return. Omit for the overview and the list of topics. |
