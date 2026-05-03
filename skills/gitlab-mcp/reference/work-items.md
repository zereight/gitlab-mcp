# Work Item Operations

> **Opt-in toolset**: Enable with `GITLAB_TOOLSETS=workitems`

Work items are GraphQL-based and cover issues, tasks, incidents, epics, objectives, requirements, tickets, and related hierarchy/status fields. Some status and custom field features require GitLab Premium/Ultimate.

## Read

```
list_work_items              -> list work items with filters
get_work_item                -> full details with status, hierarchy, type, labels, assignees, widgets
list_work_item_notes         -> notes and discussions on a work item
list_work_item_statuses      -> available statuses for a work item type
list_custom_field_definitions -> custom field definitions for a work item type
```

## Create & Update

```
create_work_item
  project_id: "my-group/my-project"
  title: "Investigate checkout failure"
  work_item_type: "issue"
  description: "Steps to reproduce..."
```

```
update_work_item             -> title, description, labels, assignees, state, parent, children, health, dates, custom fields
convert_work_item_type       -> convert issue/task/incident/etc.
move_work_item               -> move a work item to another project
create_work_item_note        -> add a note, threaded reply, or internal note
```

## Emoji Reactions

```
list_work_item_emoji_reactions       -> list reactions on a work item
create_work_item_emoji_reaction      -> add reaction to a work item
delete_work_item_emoji_reaction      -> remove reaction from a work item
list_work_item_note_emoji_reactions  -> list reactions on a work item note or thread reply
create_work_item_note_emoji_reaction -> add reaction to a work item note or thread reply
delete_work_item_note_emoji_reaction -> remove reaction from a work item note or thread reply
```

## Incident Timeline

```
get_timeline_events     -> list timeline events for an incident
create_timeline_event   -> create an incident timeline event
```
