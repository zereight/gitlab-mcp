# Webhook Operations

> **Opt-in toolset**: Enable with `GITLAB_TOOLSETS=webhooks`

## List Webhooks

Provide either `project_id` or `group_id`.

```
list_webhooks
  project_id: "my-group/my-project"
```

## Inspect Recent Events

GitLab exposes recent webhook events for the past 7 days.

```
list_webhook_events
  project_id: "my-group/my-project"
  webhook_id: 123
  summary: true
```

Fetch full event details only after narrowing to the event ID.

```
get_webhook_event
  project_id: "my-group/my-project"
  webhook_id: 123
  event_id: 456
```
