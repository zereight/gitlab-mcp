# Webhook Operations

> **Opt-in toolset**: Enable with `GITLAB_TOOLSETS=webhooks`

## List Webhooks

Provide either `project_id` or `group_id`.

```text
list_webhooks
  project_id: "my-group/my-project"
```

## Create / Update / Delete

```text
create_webhook
  project_id: "my-group/my-project"
  url: "https://example.com/hook"
  push_events: true
```

```text
update_webhook
  project_id: "my-group/my-project"
  hook_id: 123
  url: "https://example.com/hook"
  issues_events: true
```

```text
delete_webhook
  project_id: "my-group/my-project"
  hook_id: 123
```

Group hooks use `group_id` instead of `project_id`. `delete_webhook` is a delete tool and is blocked when permission mode is modify.

## Inspect Recent Events

GitLab exposes recent webhook events for the past 7 days.

```text
list_webhook_events
  project_id: "my-group/my-project"
  hook_id: 123
  summary: true
```

Fetch full event details only after narrowing to the event ID.

```text
get_webhook_event
  project_id: "my-group/my-project"
  hook_id: 123
  event_id: 456
```
