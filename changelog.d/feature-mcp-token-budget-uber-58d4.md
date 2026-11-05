### Changed

- Documented the MCP `tools/list` token budget on the default install path: keep
  core + `discover_tools` (or Skill/CLI). `GITLAB_TOOLSETS=all` loads ~all
  schemas (~73k tokens) and is not the recommended default.
- Shortened default-tool descriptions and redundant core schema field copy.
  Default `tools/list` is now 46,900 bytes (~11.7k tokens), down from 50,937
  bytes (~12.7k) on `main`. Tool behavior is unchanged.
- `discover_tools` and `help` now steer agents to activate a category on demand
  instead of `GITLAB_TOOLSETS=all`. Session discovery is session-only; with
  `OAUTH_STATELESS_MODE=true` persist a named `GITLAB_TOOLSETS` list.
