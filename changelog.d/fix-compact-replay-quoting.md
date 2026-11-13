### Security

- Compact-result replay commands (`GITLAB_MCP_COMPACT_RESULTS`) now quote every argument value with POSIX single quotes. Running the command no longer executes `$(...)`, backticks, or `$VAR` inside a value. Argument names that the tool's input schema does not declare are dropped from the command, and when a name or the tool name cannot be written safely, the reply has no command.

### Fixed

- A replay command that carries a newline in an argument passes the newline through instead of a literal backslash and `n`.
- A value that starts with `-` in a replay command is passed in `--flag=value` form, so the CLI no longer rejects it as a missing value.
- `zereight-mcp-gitlab tool` no longer drops the subcommand when a later flag value ends in `.ts` or `.js`, such as `--file-path src/app.ts`.
