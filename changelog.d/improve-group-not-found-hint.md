### Fixed

- When GitLab reports a missing group, the `Next:` hint on a group tool's error (for example `list_group_iterations` or `list_group_members`) now names `group_id`. It used to name `project_id`, which those tools do not take. Only the error text changes.
