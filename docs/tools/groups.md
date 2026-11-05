# Groups

Create new groups and subgroups.

!!! note "Feature toggle"
    Opt-in. Prefer `discover_tools` at runtime, or persist with `GITLAB_TOOLSETS=core,groups`. An explicit GITLAB_TOOLSETS list replaces core; include core to keep the default set. If you already set `GITLAB_TOOLSETS`, append `groups` to your existing list instead of replacing it (leave `GITLAB_TOOLSETS=all` unchanged). Avoid `GITLAB_TOOLSETS=all` (loads ~all schemas into tools/list). With `GITLAB_TOOL_PROFILE=slim` and `GITLAB_TOOLSETS` unset, `discover_tools` skips every tool in this group; add a tool name to `GITLAB_TOOLS` to expose it. Setting `GITLAB_TOOLSETS` disables the slim profile.

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
