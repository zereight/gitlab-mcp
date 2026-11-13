### Security

- Compact-result replay commands (`GITLAB_MCP_COMPACT_RESULTS`) now wrap every argument value that is not a plain word in POSIX single quotes, so the shell reads each value as literal text. An argument name that the tool's input schema does not declare, a name or tool name that cannot be written safely, or a value that cannot be passed as a command-line argument leaves the reply with no command. Argument names that start with `_` and secret argument names are left out of the command.

### Fixed

- A replay command that carries a newline in an argument passes the newline through instead of a literal backslash and `n`.
- A value that starts with `-` in a replay command is passed in `--flag=value` form, so the CLI no longer rejects it as a missing value.
- `zereight-mcp-gitlab tool` no longer drops the subcommand when a later flag value ends in `.ts` or `.js`, such as `--file-path src/app.ts`.
