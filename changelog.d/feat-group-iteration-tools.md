### Added

- `get_group_iteration` and `update_group_iteration` fetch or update a group iteration by ID, IID, or GraphQL GID.
- `update_work_item` accepts `remove_iteration` to detach a work item from its iteration.

### Fixed

- `get_group_iteration` prefers a primary `id` match across pages, falls back to `iid` only when no `id` matches, and rejects the lookup when those matches disagree. GraphQL GID input matches `id` only.
- `remove_iteration: "false"` stays false instead of coercing to true.
