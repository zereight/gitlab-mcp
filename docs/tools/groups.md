# Groups

Create new groups and subgroups.

!!! note "Feature toggle"
    Opt-in. Prefer `discover_tools` at runtime, or persist with `GITLAB_TOOLSETS=groups` / `GITLAB_TOOLS=`. Avoid `GITLAB_TOOLSETS=all` (loads ~all schemas into tools/list).

## Tools in this group

- [`create_group`](#create_group) — ✏️ Writes

---

### `create_group`

*✏️ Writes*

Create new group or subgroup.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|:-:|---|
| `name` | string | ✓ | The name of the group |
| `path` | string | ✓ | The path of the group |
| `description` | string |  | The group's description |
| `visibility` | enum (`private` \| `internal` \| `public`) |  | The group's visibility level |
| `parent_id` | number |  | The parent group ID for creating a subgroup |
