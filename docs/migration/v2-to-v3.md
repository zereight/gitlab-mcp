# Migrating from v2 to v3

v3.0.0 removes the settings below. v2 kept them working with deprecation warnings.
In v3 an **active** removed setting stops the server from starting. The server prints
the replacement and links back to this page, so a setting is never silently ignored.

Delete each setting below from your configuration entirely, including `false` and empty
values (for example, an empty `GITLAB_READ_ONLY_MODE=` line in a templated `.env`). Do not
leave them in place: the server accepts an inactive flag such as `--read-only=false` or
`--use-wiki=false`, but the human CLI rejects every removed flag as unknown, even with
`false` or an empty value (`tool whoami --read-only=false` fails with
`Unknown flag: --read-only`).

## Replacements

| Removed environment variable / CLI flag      | Replacement                                                                                   | Notes                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_READ_ONLY_MODE` / `--read-only`      | `GITLAB_PERMISSION_MODE=readonly` / `--permission-mode=readonly`                              | `readonly` exposes read tools only and rejects writes.                                                                    |
| `GITLAB_ALLOWED_GROUPS` / `--allowed-groups` | `GITLAB_OAUTH_ALLOWED_GROUPS` / `--oauth-allowed-groups`                                      | Enforced only with `GITLAB_MCP_OAUTH=true`.                                                                               |
| `USE_GITLAB_WIKI` / `--use-wiki`             | `GITLAB_TOOLSETS=core,wiki`                                                                   | Append `wiki` to an existing list.                                                                                        |
| `USE_MILESTONE` / `--use-milestone`          | `GITLAB_TOOLSETS=core,milestones`                                                             | Append `milestones` to an existing list.                                                                                  |
| `USE_PIPELINE` / `--use-pipeline`            | `GITLAB_TOOLSETS=core,pipelines` and `GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint` | The two CI lint tools live in the `ci` toolset, not `pipelines`. Add them through `GITLAB_TOOLS` only if you use CI lint. |

## Keep `core` in `GITLAB_TOOLSETS`

An explicit `GITLAB_TOOLSETS` list **replaces** the default toolsets; it does not merge
with them. `core` is the default starter set (merge requests, issues, repositories,
branches, projects, labels, and identity). If you write `GITLAB_TOOLSETS=wiki`, those core
tools disappear.

- Always include `core`: `GITLAB_TOOLSETS=core,wiki`, not `GITLAB_TOOLSETS=wiki`.
- Append to a list you already have. Do not replace it.
- `GITLAB_TOOLSETS=all` already includes `wiki`, `milestones`, and `pipelines`, so leave it
  exactly as it is. `all` is only valid on its own; `all,wiki` drops `all` as an unknown
  name and leaves a list without `core`.

## Group access control needs MCP OAuth

`GITLAB_OAUTH_ALLOWED_GROUPS` restricts access only when `GITLAB_MCP_OAUTH=true`. With the
variable set and OAuth off, the server logs `Group access control enabled` but does not check
group membership. If you need group restriction, set both `GITLAB_MCP_OAUTH=true` and
`GITLAB_OAUTH_ALLOWED_GROUPS`.

## Example

```bash
# v2 configuration
GITLAB_READ_ONLY_MODE=true
GITLAB_ALLOWED_GROUPS=my-group
USE_GITLAB_WIKI=true
USE_PIPELINE=true

# v3 configuration
GITLAB_PERMISSION_MODE=readonly
GITLAB_OAUTH_ALLOWED_GROUPS=my-group   # requires GITLAB_MCP_OAUTH=true
GITLAB_TOOLSETS=core,wiki,pipelines
GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint   # only if you use CI lint
```

## What a leftover setting looks like

Startup stops with a message like this:

```text
Removed configuration detected:
- GITLAB_READ_ONLY_MODE (--read-only) was removed. Use GITLAB_PERMISSION_MODE=readonly (or --permission-mode=readonly) instead.
Migration guide: https://github.com/zereight/gitlab-mcp/blob/main/docs/migration/v2-to-v3.md
Tracking issue: https://github.com/zereight/gitlab-mcp/issues/815
```

Remove the named setting and restart. The same check runs for the human CLI and for the
OAuth `auth` command.

## Security support

v2 security support ends on **2027-02-28 or 90 days after the v3.0 release, whichever is
later**. Plan the upgrade to v3 before then.

## See also

- [Environment variables](../configuration/environment-variables.md)
- [CLI arguments](../getting-started/cli-arguments.md)
- [Core toolset](../tools/core.md)
- [Tracking issue #815](https://github.com/zereight/gitlab-mcp/issues/815)
