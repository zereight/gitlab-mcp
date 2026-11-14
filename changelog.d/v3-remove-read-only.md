### Breaking changes

- Remove `GITLAB_READ_ONLY_MODE` / `--read-only`; use `GITLAB_PERMISSION_MODE=readonly` / `--permission-mode=readonly`.
- Removed settings that are still active now stop startup with migration guidance (server, human CLI, OAuth `auth`, and Docker Compose), rather than silently dropping the read-only restriction. `GITLAB_READ_ONLY_MODE=false`, `--read-only=false`, and empty values remain harmless; remove them from configuration.
