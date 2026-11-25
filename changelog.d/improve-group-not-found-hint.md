### Fixed

- When GitLab reports a missing group, the `Next:` hint on a group tool's error (for example `list_group_iterations` or `list_group_members`) now names `group_id`. It used to name `project_id`, which those tools do not take. Namespace tools that take `project_id` (for example `get_work_item` with `project_id: "group:<path>"`) keep the `project_id` hint for that missing group. Only the error text changes.
