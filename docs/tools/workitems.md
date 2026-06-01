# Work Items

Modern unified API for issues, tasks, incidents, and other typed work items — including notes, emoji reactions, and incident timeline events.

## Tools in this group

- [`get_work_item`](#get_work_item) — 📖 Read-only
- [`list_work_items`](#list_work_items) — 📖 Read-only
- [`create_work_item`](#create_work_item) — ✏️ Writes
- [`update_work_item`](#update_work_item) — ✏️ Writes
- [`convert_work_item_type`](#convert_work_item_type) — ✏️ Writes
- [`list_work_item_statuses`](#list_work_item_statuses) — 📖 Read-only
- [`list_custom_field_definitions`](#list_custom_field_definitions) — 📖 Read-only
- [`move_work_item`](#move_work_item) — ✏️ Writes
- [`list_work_item_notes`](#list_work_item_notes) — 📖 Read-only
- [`create_work_item_note`](#create_work_item_note) — ✏️ Writes
- [`list_work_item_emoji_reactions`](#list_work_item_emoji_reactions) — 📖 Read-only
- [`list_work_item_note_emoji_reactions`](#list_work_item_note_emoji_reactions) — 📖 Read-only
- [`create_work_item_emoji_reaction`](#create_work_item_emoji_reaction) — ✏️ Writes
- [`delete_work_item_emoji_reaction`](#delete_work_item_emoji_reaction) — ✏️ Writes
- [`create_work_item_note_emoji_reaction`](#create_work_item_note_emoji_reaction) — ✏️ Writes
- [`delete_work_item_note_emoji_reaction`](#delete_work_item_note_emoji_reaction) — ✏️ Writes
- [`get_timeline_events`](#get_timeline_events) — 📖 Read-only
- [`create_timeline_event`](#create_timeline_event) — ✏️ Writes

---

### `get_work_item`

*📖 Read-only*

Get a work item with full details including status, hierarchy, type, and widgets

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID (IID) of the work item |

### `list_work_items`

*📖 Read-only*

List work items with filters (type, state, search, assignees, labels)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `types` | array<any> |  | Filter by work item types. If not set, returns all types. |
| `state` | enum (`opened` \| `closed`) |  | Filter by state |
| `search` | string |  | Search in title and description |
| `assignee_usernames` | array<string> |  | Filter by assignee usernames |
| `label_names` | array<string> |  | Filter by label names |
| `first` | number |  | Number of items to return (max 100). Default 20. |
| `after` | string |  | Cursor for pagination (from previous response's endCursor) |

### `create_work_item`

*✏️ Writes*

Create a work item (issue, task, incident, epic, etc.) with full field support

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `title` | string | ✓ | Title of the work item |
| `type` | any |  | Type of work item to create. Defaults to 'issue'. |
| `description` | string |  | Description of the work item (Markdown supported) |
| `labels` | array<string> |  | Array of label names to assign |
| `assignee_usernames` | array<string> |  | Array of usernames to assign |
| `parent_iid` | number |  | IID of the parent work item to set hierarchy |
| `weight` | number |  | Weight of the work item |
| `health_status` | enum (`onTrack` \| `needsAttention` \| `atRisk`) |  | Set health status |
| `start_date` | string |  | Start date in YYYY-MM-DD format |
| `due_date` | string |  | Due date in YYYY-MM-DD format |
| `milestone_id` | string |  | Milestone ID (GitLab global ID format, e.g. 'gid://gitlab/Milestone/123', or numeric ID) |
| `iteration_id` | string |  | Iteration ID (e.g. 'gid://gitlab/Iteration/123' or numeric ID). Use list_group_iterations to find available iterations. |
| `confidential` | boolean |  | Set confidentiality |

### `update_work_item`

*✏️ Writes*

Update a work item (title, description, labels, assignees, state, parent, custom fields, etc.)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID (IID) of the work item |
| `title` | string |  | New title |
| `description` | string |  | New description (Markdown supported) |
| `add_labels` | array<string> |  | Label names to add |
| `remove_labels` | array<string> |  | Label names to remove |
| `assignee_usernames` | array<string> |  | Set assignees by username (replaces existing) |
| `state_event` | enum (`close` \| `reopen`) |  | Close or reopen the work item |
| `weight` | number |  | Set weight (issues, tasks, epics only) |
| `status` | string |  | Set status by ID. Use list_work_item_statuses to get available status IDs. |
| `parent_iid` | number |  | Set parent work item by IID. Use with parent_project_id if parent is in a different project. |
| `parent_project_id` | string |  | Project ID or path of the parent work item (defaults to same project as the work item) |
| `remove_parent` | boolean |  | Set to true to remove the parent from hierarchy |
| `children_to_add` | array<object> |  | Array of children to add to this work item's hierarchy |
| `children_to_remove` | array<object> |  | Array of children to remove from this work item's hierarchy |
| `health_status` | enum (`onTrack` \| `needsAttention` \| `atRisk`) |  | Set health status on issues and epics |
| `start_date` | string |  | Start date in YYYY-MM-DD format |
| `due_date` | string |  | Due date in YYYY-MM-DD format |
| `milestone_id` | string |  | Milestone ID (GitLab global ID format, e.g. 'gid://gitlab/Milestone/123', or numeric ID) |
| `iteration_id` | string |  | Iteration ID (e.g. 'gid://gitlab/Iteration/123' or numeric ID). Use list_group_iterations to find available iterations. |
| `confidential` | boolean |  | Set confidentiality |
| `linked_items_to_add` | array<object> |  | Work items to link |
| `linked_items_to_remove` | array<object> |  | Linked work items to remove |
| `custom_fields` | array<object> |  | Custom field values to set |
| `severity` | enum (`UNKNOWN` \| `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`) |  | Incident only: set severity level |
| `escalation_status` | enum (`TRIGGERED` \| `ACKNOWLEDGED` \| `RESOLVED` \| `IGNORED`) |  | Incident only: set escalation status |

### `convert_work_item_type`

*✏️ Writes*

Convert a work item to a different type

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `new_type` | any | ✓ | The target work item type to convert to |

### `list_work_item_statuses`

*📖 Read-only*

List available statuses for a work item type (Premium/Ultimate)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `work_item_type` | any |  | The work item type to list available statuses for. Defaults to 'issue'. |

### `list_custom_field_definitions`

*📖 Read-only*

List custom field definitions for a work item type

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `work_item_type` | any |  | The work item type to list custom field definitions for. Defaults to 'issue'. |

### `move_work_item`

*✏️ Writes*

Move a work item to a different project

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path of the source namespace |
| `iid` | number | ✓ | The internal ID of the work item to move |
| `target_project_id` | string | ✓ | Project ID, URL-encoded project path, or group path of the target namespace |

### `list_work_item_notes`

*📖 Read-only*

List notes and discussions on a work item

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `page_size` | number |  | Number of discussions to return (default 20) |
| `after` | string |  | Cursor for pagination |
| `sort` | enum (`CREATED_ASC` \| `CREATED_DESC`) |  | Sort order for discussions |

### `create_work_item_note`

*✏️ Writes*

Add a note to a work item (supports Markdown, internal notes, threads)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `body` | string | ✓ | Note body (Markdown supported) |
| `internal` | boolean |  | Create as internal/confidential note (only visible to project members) |
| `discussion_id` | string |  | Discussion ID to reply to (for threaded replies). If omitted, creates a new top-level note. |

### `list_work_item_emoji_reactions`

*📖 Read-only*

List all emoji reactions on a work item

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |

### `list_work_item_note_emoji_reactions`

*📖 Read-only*

List all emoji reactions on a work item note (comment, thread, or thread reply)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `note_id` | string | ✓ | The GraphQL GID of the note (e.g. 'gid://gitlab/Note/123' from list_work_item_notes) |

### `create_work_item_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to a work item (e.g. thumbsup, rocket, eyes)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_work_item_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from a work item

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `create_work_item_note_emoji_reaction`

*✏️ Writes*

Add an emoji reaction to a work item note (comment, thread, or thread reply)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `note_id` | string | ✓ | The GraphQL GID of the note (e.g. 'gid://gitlab/Note/123' from list_work_item_notes) |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `delete_work_item_note_emoji_reaction`

*✏️ Writes*

Remove an emoji reaction from a work item note (comment, thread, or thread reply)

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID, URL-encoded project path, or group path (e.g. 'group/subgroup' for group-level work items) |
| `iid` | number | ✓ | The internal ID of the work item |
| `note_id` | string | ✓ | The GraphQL GID of the note (e.g. 'gid://gitlab/Note/123' from list_work_item_notes) |
| `name` | string | ✓ | Name of the emoji without colons (e.g. 'thumbsup', 'rocket', 'eyes') |

### `get_timeline_events`

*📖 Read-only*

List timeline events for an incident

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `incident_iid` | number | ✓ | The internal ID (IID) of the incident |

### `create_timeline_event`

*✏️ Writes*

Create a timeline event on an incident

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `project_id` | string | ✓ | Project ID or URL-encoded path |
| `incident_iid` | number | ✓ | The internal ID (IID) of the incident |
| `note` | string | ✓ | Description of the timeline event (Markdown supported) |
| `occurred_at` | string | ✓ | When the event occurred in ISO 8601 format (e.g. '2026-03-15T09:00:00.000Z') |
| `tag_names` | array<enum (`Start time` \| `End time` \| `Impact detected` \| `Response initiated` \| `Impact mitigated` \| `Cause identified`)> |  | Timeline event tags to attach. Available: 'Start time', 'End time', 'Impact detected', 'Response initiated', 'Impact mitigated', 'Cause identified'. |
