# Wiki

Project and group wiki page CRUD. Attachment uploads where supported.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=wiki` (or `GITLAB_TOOLSETS=all`), or use the legacy `USE_GITLAB_WIKI=true` flag for backward compatibility.

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

List wiki pages in a project. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `with_content` | boolean |  | Include content of the wiki pages |
| `render_html` | boolean |  | Return rendered HTML content and include front_matter (e.g., the custom title) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_wiki_page`

*📖 Read-only*

Get details of a specific wiki page. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `render_html` | boolean |  | Return rendered HTML content and include front_matter (e.g., the custom title) |

### `create_wiki_page`

*✏️ Writes*

Create a wiki page in a project. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `title` | string | ✓ | Title of the wiki page |
| `content` | string | ✓ | Content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `update_wiki_page`

*✏️ Writes*

Update a wiki page in a project. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `title` | string |  | New title of the wiki page. WARNING: setting this renames the page and changes its slug/URL (for nested pages it can also move the page to a different path), which breaks existing links. To change only the displayed title while keeping the URL, omit this parameter and instead set a `title:` field in the content's YAML front matter. |
| `content` | string |  | New content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `delete_wiki_page`

*✏️ Writes*

Delete a wiki page from a project. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |

### `list_group_wiki_pages`

*📖 Read-only*

List wiki pages in a group. Use this for a collection of resources; choose the corresponding get tool when you already know the single resource to inspect. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `with_content` | boolean |  | Include content of the wiki pages |
| `render_html` | boolean |  | Return rendered HTML content and include front_matter (e.g., the custom title) |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_group_wiki_page`

*📖 Read-only*

Get details of a specific group wiki page. Use this for a known resource or result; choose the corresponding list or search tool when you need to discover multiple resources. It is read-only and does not mutate GitLab data; missing resources, invalid identifiers, insufficient permission, and rate limits are returned as errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `render_html` | boolean |  | Return rendered HTML content and include front_matter (e.g., the custom title) |

### `create_group_wiki_page`

*✏️ Writes*

Create a wiki page in a group. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `title` | string | ✓ | Title of the wiki page |
| `content` | string | ✓ | Content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `update_group_wiki_page`

*✏️ Writes*

Update a wiki page in a group. Use this for an existing resource; choose the corresponding create tool for a new resource and a note tool for discussion-only text. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `title` | string |  | New title of the wiki page. WARNING: setting this renames the page and changes its slug/URL (for nested pages it can also move the page to a different path), which breaks existing links. To change only the displayed title while keeping the URL, omit this parameter and instead set a `title:` field in the content's YAML front matter. |
| `content` | string |  | New content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `delete_group_wiki_page`

*✏️ Writes*

Delete a wiki page from a group. Use this only after verifying the target; choose a get or list tool first when you need to inspect state without changing it. It changes or removes remote GitLab data and may be irreversible; it requires the necessary project or group permission and returns validation, conflict, permission, or rate-limit errors. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
