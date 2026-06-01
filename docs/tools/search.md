# Search

Code search across all visible projects, a specific project, or a specific group.

## Tools in this group

- [`search_code`](#search_code) — 📖 Read-only
- [`search_project_code`](#search_project_code) — 📖 Read-only
- [`search_group_code`](#search_group_code) — 📖 Read-only

---

### `search_code`

*📖 Read-only*

Search for code across all projects (requires advanced search or Zoekt)

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

Search for code within a specific project (requires advanced search or Zoekt)

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

Search for code within a specific group (requires advanced search or Zoekt)

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
