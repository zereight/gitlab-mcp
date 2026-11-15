### Added

- `list_issues` accepts `order_by` and `sort`, so results can be returned in
  another order than GitLab's default `created_at desc`, for example the manual
  board order with `order_by: relative_position, sort: asc`.
