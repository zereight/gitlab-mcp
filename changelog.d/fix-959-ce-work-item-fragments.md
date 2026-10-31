### Fixed

- `get_work_item`, `list_work_items`, and `update_work_item` no longer fail on
  GitLab CE (and older EE releases) with `No such type WorkItemWidgetStatus`.
  When GitLab rejects a widget type or field that only Premium/Ultimate defines,
  the server drops that selection, retries, and remembers the result per
  instance. Premium/Ultimate and gitlab.com send the same query as before and
  return the same fields. `list_issue_statuses` and
  `list_custom_field_definitions` now report no statuses or custom fields on CE
  instead of erroring. (#959)
