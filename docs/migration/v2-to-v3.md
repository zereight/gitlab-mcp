# Migrating from v2 to v3

v3.0.0 removes the settings below. v2 kept them working with deprecation warnings.
This page describes the complete v3.0.0 release. The removals land together and ship only
in v3.0.0; no v2 release removes any of them.
In v3 an **active** removed setting stops the server from starting. The server prints
the replacement and links back to this page, so a setting is never silently ignored.

Delete each setting below from your configuration entirely, including `false` and empty
values (for example, an empty `GITLAB_READ_ONLY_MODE=` line in a templated `.env`). Do not
leave them in place: the server accepts an inactive `--read-only=false`, but the human CLI
rejects it as an unknown flag (`tool whoami --read-only=false` fails with
`Unknown flag: --read-only`).

## Replacements

| Removed environment variable / CLI flag      | Replacement                                                                                             | Notes                                                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_READ_ONLY_MODE` / `--read-only`      | `GITLAB_PERMISSION_MODE=readonly` / `--permission-mode=readonly`                                        | `readonly` exposes read tools only and rejects writes.                                                                                                                                                                           |
| `GITLAB_ALLOWED_GROUPS` / `--allowed-groups` | `GITLAB_OAUTH_ALLOWED_GROUPS` / `--oauth-allowed-groups`                                                | Enforced only with `GITLAB_MCP_OAUTH=true`.                                                                                                                                                                                      |
| `USE_GITLAB_WIKI` / `--use-wiki`             | Add `wiki` to `GITLAB_TOOLSETS`                                                                         | Only if it was enabled. See [Choose the new `GITLAB_TOOLSETS` value](#choose-the-new-gitlab_toolsets-value).                                                                                                                     |
| `USE_MILESTONE` / `--use-milestone`          | Add `milestones` to `GITLAB_TOOLSETS`                                                                   | Only if it was enabled. See [Choose the new `GITLAB_TOOLSETS` value](#choose-the-new-gitlab_toolsets-value).                                                                                                                     |
| `USE_PIPELINE` / `--use-pipeline`            | Add `pipelines` to `GITLAB_TOOLSETS`, and `validate_ci_lint,validate_project_ci_lint` to `GITLAB_TOOLS` | Only if it was enabled. See [Choose the new `GITLAB_TOOLSETS` value](#choose-the-new-gitlab_toolsets-value). The CI lint tools live in the `ci` toolset; append them to an existing `GITLAB_TOOLS` list only if you use CI lint. |

For the boolean settings (`GITLAB_READ_ONLY_MODE` and the `USE_*` settings), use a replacement
only if the setting was **enabled** in v2 (`true` or a bare flag). A `false` or empty value
needs no replacement: delete it. For a `USE_*` setting, do not add its toolset
(`wiki`, `milestones`, or `pipelines`) to `GITLAB_TOOLSETS`, or you expose tools that v2
kept off (for example the wiki create, update, and delete tools).

## Choose the new `GITLAB_TOOLSETS` value

Keep exactly the toolsets you had in v2, then add the replacement for each enabled `USE_*`
setting. Add `core` only if v2 actually exposed core tools for you. In v2 the server chose
toolsets like this, and v3 keeps the same rules:

- `GITLAB_TOOLSETS` unset or empty: the default toolset, which is `core` only (merge
  requests, issues, repositories, branches, projects, labels, and identity). A value with
  no valid toolset name also falls back to this default.
- `GITLAB_TOOLSETS` set to a list: exactly the listed toolsets. The list **replaces** the
  default, so `core` is exposed only if it is listed.
- `GITLAB_TOOLSETS=all`: every toolset except explicit-only ones such as `api`.
- `USE_GITLAB_WIKI`, `USE_MILESTONE`, and `USE_PIPELINE` added their tools on top of
  whichever of these applied.

So:

- **`GITLAB_TOOLSETS` was unset, empty, or had no valid toolset name** (for example
  `GITLAB_TOOLSETS=unknown`): v2 fell back to `core`, so keep it: `GITLAB_TOOLSETS=core,wiki`.
  Writing `GITLAB_TOOLSETS=wiki` or `unknown,wiki` would drop the core tools.
- **`GITLAB_TOOLSETS` was a list with at least one valid toolset name:** append the new toolset to that list as it is, and do
  not add `core` unless it was already there. For example, `GITLAB_TOOLSETS=search` with
  `USE_GITLAB_WIKI=true` becomes `GITLAB_TOOLSETS=search,wiki`, not
  `GITLAB_TOOLSETS=core,search,wiki`. Adding `core` would expose tools such as
  `create_issue` that v2 did not expose for you.
- **`GITLAB_TOOLSETS=all`:** it already includes `wiki`, `milestones`, and `pipelines`, so
  leave it exactly as it is. `all` is only valid on its own; `all,wiki` drops `all` as an
  unknown name.
- Append only the toolsets whose legacy setting was enabled.
- `GITLAB_TOOL_PROFILE=slim` applies only while `GITLAB_TOOLSETS` is unset. If you used
  `slim` without `GITLAB_TOOLSETS`, setting `GITLAB_TOOLSETS` turns the slim profile off
  (the server logs a warning).

## Group access control needs MCP OAuth

`GITLAB_OAUTH_ALLOWED_GROUPS` restricts access only when `GITLAB_MCP_OAUTH=true`. With the
variable set and OAuth off, the server logs `Group access control enabled` but does not check
group membership. If you need group restriction, set both `GITLAB_MCP_OAUTH=true` and
`GITLAB_OAUTH_ALLOWED_GROUPS`.

## Example

```bash
# v2 configuration (GITLAB_TOOLSETS unset, so v2 exposed core)
GITLAB_READ_ONLY_MODE=true
GITLAB_ALLOWED_GROUPS=my-group
USE_GITLAB_WIKI=true
USE_PIPELINE=true

# v3 configuration
GITLAB_PERMISSION_MODE=readonly
GITLAB_OAUTH_ALLOWED_GROUPS=my-group   # requires GITLAB_MCP_OAUTH=true
GITLAB_TOOLSETS=core,wiki,pipelines
GITLAB_TOOLS=validate_ci_lint,validate_project_ci_lint   # only if you use CI lint

# v2 configuration with an explicit list that omits core
GITLAB_TOOLSETS=search
USE_GITLAB_WIKI=true

# v3 configuration: keep the list, append wiki, do not add core
GITLAB_TOOLSETS=search,wiki
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
