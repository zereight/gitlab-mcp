### Fixed

- `create_tag`, `get_tag`, and `list_tags` no longer fail with `created_at: Invalid input` on GitLab versions before 16.11, which do not return the top-level tag `created_at`. A `null` `commit.created_at` or `release.description` is accepted too (#1015).
