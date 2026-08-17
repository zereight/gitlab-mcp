# Groups

Create new groups and subgroups.

## Tools in this group

- [`create_group`](#create_group) — ✏️ Writes

---

### `create_group`

*✏️ Writes*

Create new group or subgroup. Use this for a new resource or action; choose the corresponding update or edit tool when the resource already exists. It changes remote GitLab state and requires the necessary project or group permission; GitLab returns validation, conflict, permission, or rate-limit errors instead of silently applying an invalid request. When `project_id` or `group_id` is accepted, provide the numeric ID or complete URL-encoded path described by the schema; use required identifiers and pagination fields exactly as documented.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `name` | string | ✓ | The name of the group |
| `path` | string | ✓ | The path of the group |
| `description` | string |  | The group's description |
| `visibility` | enum (`private` \| `internal` \| `public`) |  | The group's visibility level |
| `parent_id` | number |  | The parent group ID for creating a subgroup |
