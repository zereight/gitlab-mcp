# Search

Code search across all visible projects, a specific project, or a specific group.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=search` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`search_code`](#search_code) — 📖 Read-only
- [`search_project_code`](#search_project_code) — 📖 Read-only
- [`search_group_code`](#search_group_code) — 📖 Read-only

---

### `search_code`

*📖 Read-only*

Search for code across all projects (requires advanced search or Zoekt). Use this to discover matching content; choose a typed get or list tool when the target identifier is already known. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `search` | string | ✓ | Code search query string. On instances with exact code search (Zoekt), the query supports rich inline syntax: "class foo" (exact match), foo file:\.js$ (file pattern), foo lang:ruby (language), sym:foo (symbol search), foo -bar (negation), case:yes (case-sensitive). When using Zoekt inline filters, prefer them over the separate filename/path/extension params which are for basic search. |
| `filename` | string |  | Filter by filename (supports * wildcard, e.g. '*.ts') |
| `path` | string |  | Filter by file path (supports * wildcard, e.g. 'src/utils/*') |
| `extension` | string |  | Filter by file extension without dot (e.g. 'py', 'ts') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `search_project_code`

*📖 Read-only*

Search for code within a specific project (requires advanced search or Zoekt). Use this to discover matching content; choose a typed get or list tool when the target identifier is already known. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or complete URL-encoded path to project |
| `search` | string | ✓ | Code search query string. On instances with exact code search (Zoekt), the query supports rich inline syntax: "class foo" (exact match), foo file:\.js$ (file pattern), foo lang:ruby (language), sym:foo (symbol search), foo -bar (negation), case:yes (case-sensitive). When using Zoekt inline filters, prefer them over the separate filename/path/extension params which are for basic search. |
| `filename` | string |  | Filter by filename (supports * wildcard, e.g. '*.ts') |
| `path` | string |  | Filter by file path (supports * wildcard, e.g. 'src/utils/*') |
| `extension` | string |  | Filter by file extension without dot (e.g. 'py', 'ts') |
| `ref` | string |  | Branch or tag to search in (defaults to default branch) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `search_group_code`

*📖 Read-only*

Search for code within a specific group (requires advanced search or Zoekt). Use this to discover matching content; choose a typed get or list tool when the target identifier is already known. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `search` | string | ✓ | Code search query string. On instances with exact code search (Zoekt), the query supports rich inline syntax: "class foo" (exact match), foo file:\.js$ (file pattern), foo lang:ruby (language), sym:foo (symbol search), foo -bar (negation), case:yes (case-sensitive). When using Zoekt inline filters, prefer them over the separate filename/path/extension params which are for basic search. |
| `filename` | string |  | Filter by filename (supports * wildcard, e.g. '*.ts') |
| `path` | string |  | Filter by file path (supports * wildcard, e.g. 'src/utils/*') |
| `extension` | string |  | Filter by file extension without dot (e.g. 'py', 'ts') |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |
