### Breaking changes

- Remove `GITLAB_READ_ONLY_MODE` / `--read-only`; use `GITLAB_PERMISSION_MODE=readonly` / `--permission-mode=readonly`.
- Removed settings that are still active now stop startup with migration guidance (server, human CLI, OAuth `auth`, and Docker Compose), rather than silently dropping the read-only restriction. Delete `GITLAB_READ_ONLY_MODE` and `--read-only` from configuration entirely, including `=false` and empty values: the human CLI (`tool ...`) rejects `--read-only=false` as an unknown flag.
- Added the [v2 to v3 migration guide](docs/migration/v2-to-v3.md) covering all v3.0.0 removals, the replacement table, and the v2 security support end date.
