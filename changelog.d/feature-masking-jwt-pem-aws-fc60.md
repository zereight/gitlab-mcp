### Added

- Built-in response masking (opt-in via `GITLAB_MASKING_ENABLED`) now redacts JWTs, PEM private key blocks, and AWS access key IDs (`AKIA`/`ASIA`), plus `aws_secret_access_key` assignments. Each builtin can be disabled or given a custom replacement under `builtins`.
