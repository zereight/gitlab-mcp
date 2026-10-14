# Wiki

Project and group wiki page CRUD. Attachment uploads where supported.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=core,wiki` (or `GITLAB_TOOLSETS=all`). If you already set `GITLAB_TOOLSETS`, append `wiki` to your existing list instead of replacing it. `USE_GITLAB_WIKI=true` is deprecated (removed in next major (v3.0.0)).

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

List wiki pages in a project. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

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

Get details of a specific wiki page. To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `render_html` | boolean |  | Return rendered HTML content and include front_matter (e.g., the custom title) |

### `create_wiki_page`

*✏️ Writes*

Create a wiki page in a project. If the resource already exists, use the update tool. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `title` | string | ✓ | Title of the wiki page |
| `content` | string | ✓ | Content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `update_wiki_page`

*✏️ Writes*

Update a wiki page in a project. Use the create tool for new resources and a note tool for comments. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

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

Delete a wiki page from a project. Verify the target first with a get or list tool. Changes or removes GitLab data and may be irreversible; needs permission. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |

### `list_group_wiki_pages`

*📖 Read-only*

List wiki pages in a group. For one known resource, use the matching get tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

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

Get details of a specific group wiki page. To find resources, use the matching list or search tool. Read-only; missing resources, denied access, and rate limits return errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
| `render_html` | boolean |  | Return rendered HTML content and include front_matter (e.g., the custom title) |

### `create_group_wiki_page`

*✏️ Writes*

Create a wiki page in a group. If the resource already exists, use the update tool. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `title` | string | ✓ | Title of the wiki page |
| `content` | string | ✓ | Content of the wiki page |
| `format` | string |  | Content format, e.g., markdown, rdoc |

### `update_group_wiki_page`

*✏️ Writes*

Update a wiki page in a group. Use the create tool for new resources and a note tool for comments. Changes GitLab data; needs permission and returns validation or conflict errors. `project_id`/`group_id` take a numeric ID or URL-encoded path.

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

Delete a wiki page from a group. Verify the target first with a get or list tool. Changes or removes GitLab data and may be irreversible; needs permission. `project_id`/`group_id` take a numeric ID or URL-encoded path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `group_id` | string | ✓ | Group ID or URL-encoded path |
| `slug` | string | ✓ | Slug of the wiki page (will be URL-encoded internally) |
