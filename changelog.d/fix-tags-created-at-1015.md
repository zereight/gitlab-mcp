### Fixed

- `create_tag`, `get_tag`, and `list_tags` no longer fail with `Unexpected GitLab response ... created_at: Invalid input` on GitLab 16.x, which omits the top-level tag `created_at`. Lightweight tags with a `null` `created_at`, `message`, or `commit.created_at` are accepted too (#1015).
