# Releases

Release lifecycle, release evidence, and asset download.

!!! note "Feature toggle"
    Opt-in. Enable via `GITLAB_TOOLSETS=releases` (or `GITLAB_TOOLSETS=all`), list individual tools in `GITLAB_TOOLS=`, or activate at runtime with the `discover_tools` MCP tool.

## Tools in this group

- [`list_releases`](#list_releases) — 📖 Read-only
- [`get_release`](#get_release) — 📖 Read-only
- [`create_release`](#create_release) — ✏️ Writes
- [`update_release`](#update_release) — ✏️ Writes
- [`delete_release`](#delete_release) — ✏️ Writes
- [`create_release_evidence`](#create_release_evidence) — ✏️ Writes
- [`download_release_asset`](#download_release_asset) — 📖 Read-only

---

### `list_releases`

*📖 Read-only*

List all releases for a project. For one known resource, use the matching get tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `order_by` | enum (`released_at` \| `created_at`) |  | The field to use as order. Either released_at (default) or created_at. |
| `sort` | enum (`desc` \| `asc`) |  | The direction of the order. Either desc (default) for descending order or asc for ascending order. |
| `include_html_description` | boolean |  | If true, a response includes HTML rendered Markdown of the release description. |
| `page` | number |  | Page number for pagination (default: 1) |
| `per_page` | number |  | Number of items per page (max: 100, default: 20) |

### `get_release`

*📖 Read-only*

Get a release by tag name. To find resources, use the matching list or search tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The Git tag the release is associated with |
| `include_html_description` | boolean |  | If true, a response includes HTML rendered Markdown of the release description. |

### `create_release`

*✏️ Writes*

Create a new release. If the resource already exists, use the update tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The tag where the release is created from |
| `name` | string |  | The release name |
| `tag_message` | string |  | Message to use if creating a new annotated tag |
| `description` | string |  | The description of the release. You can use Markdown. |
| `ref` | string |  | If a tag specified in tag_name doesn't exist, the release is created from ref and tagged with tag_name. It can be a commit SHA, another tag name, or a branch name. |
| `milestones` | array<string> |  | The title of each milestone the release is associated with. GitLab Premium customers can specify group milestones. |
| `assets` | object |  | An array of assets links |
| `released_at` | string |  | Date and time for the release. Defaults to the current time. Expected in ISO 8601 format (2019-03-15T08:00:00Z). Only provide this field if creating an upcoming or historical release. |

### `update_release`

*✏️ Writes*

Update an existing release. Use the create tool for new resources.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The Git tag the release is associated with |
| `name` | string |  | The release name |
| `description` | string |  | The description of the release. You can use Markdown. |
| `milestones` | array<string> |  | The title of each milestone to associate with the release. GitLab Premium customers can specify group milestones. To remove all milestones from the release, specify []. |
| `released_at` | string |  | The date when the release is/was ready. Expected in ISO 8601 format (2019-03-15T08:00:00Z). |

### `delete_release`

*✏️ Writes*

Delete a release (does not delete the tag). Verify the target first with a get or list tool.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The Git tag the release is associated with |

### `create_release_evidence`

*✏️ Writes*

Create release evidence (Premium/Ultimate).

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The Git tag the release is associated with |

### `download_release_asset`

*📖 Read-only*

Download a release asset file by direct asset path.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `tag_name` | string | ✓ | The Git tag the release is associated with |
| `direct_asset_path` | string | ✓ | Path to the release asset file as specified when creating or updating its link |
