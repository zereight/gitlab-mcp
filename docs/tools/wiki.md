# Wiki

Project and group wiki page CRUD. Attachment uploads where supported.

!!! note "Feature toggle"
    Gated by `USE_GITLAB_WIKI=true`. Disabled by default; enable to expose this entire group.

## Tools in this group

- [`list_wiki_pages`](#list_wiki_pages) — 📖 Read-only
- [`get_wiki_page`](#get_wiki_page) — 📖 Read-only
- [`create_wiki_page`](#create_wiki_page) — ✏️ Writes
- [`update_wiki_page`](#update_wiki_page) — ✏️ Writes
- [`delete_wiki_page`](#delete_wiki_page) — ✏️ Writes
- [`list_group_wiki_pages`](#list_group_wiki_pages) — 📖 Read-only
- [`get_group_wiki_page`](#get_group_wiki_page) — 📖 Read-only
- [`create_group_wiki_page`](#create_group_wiki_page) — ✏️ Writes
- [`update_group_wiki_page`](#update_group_wiki_page) — ✏️ Writes
- [`delete_group_wiki_page`](#delete_group_wiki_page) — ✏️ Writes

---

### `list_wiki_pages`

*📖 Read-only*

List wiki pages in a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `with_content` | boolean |  | Include content of the wiki pages |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_wiki_page`

*📖 Read-only*

Get details of a specific wiki page

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |

### `create_wiki_page`

*✏️ Writes*

Create a wiki page in a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `title` | string | ✓ | Title of the wiki page |
| `content` | string | ✓ | Content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `update_wiki_page`

*✏️ Writes*

Update a wiki page in a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `title` | string |  | New title of the wiki page |
| `content` | string |  | New content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `delete_wiki_page`

*✏️ Writes*

Delete a wiki page from a project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |

### `list_group_wiki_pages`

*📖 Read-only*

List wiki pages in a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `with_content` | boolean |  | Include content of the wiki pages |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_group_wiki_page`

*📖 Read-only*

Get details of a specific group wiki page

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |

### `create_group_wiki_page`

*✏️ Writes*

Create a wiki page in a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `title` | string | ✓ | Title of the wiki page |
| `content` | string | ✓ | Content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `update_group_wiki_page`

*✏️ Writes*

Update a wiki page in a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `title` | string |  | New title of the wiki page |
| `content` | string |  | New content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `delete_group_wiki_page`

*✏️ Writes*

Delete a wiki page from a group

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
