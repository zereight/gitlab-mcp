---
name: gl-cli
description: Use GitLab from the terminal without registering an MCP server. Covers authenticating the zereight-mcp-gitlab CLI (PAT or OAuth device flow) and reading merge requests, diffs, discussions, issues, and pipelines. Use when the user asks about a GitLab MR/issue/pipeline and no GitLab MCP tools are available, or wants CLI-only setup.
---

# gl-cli

`zereight-mcp-gitlab` (alias `mcp-gitlab`) is both the MCP server and a GitLab CLI. Run it with a command and it prints the result and exits. No MCP client is involved.

Full guide: `docs/getting-started/cli-without-mcp.md`.

## 1. Check credentials first

Run this before anything else and read the result:

```bash
zereight-mcp-gitlab user whoami
```

- Prints a user: credentials work, go to step 3.
- `Missing GitLab credentials` (exit 2): go to step 2.
- `401`: token expired or under-scoped, redo step 2.
- `command not found`: `npm install -g @zereight/mcp-gitlab`.

## 2. Authenticate (ask the user which option)

Never invent, guess, or echo a token. Ask the user to run the command themselves, since it needs their secret.

**A. Personal Access Token** (fastest; scope `read_api`, or `api` to write)

```bash
read -rs GITLAB_PERSONAL_ACCESS_TOKEN && export GITLAB_PERSONAL_ACCESS_TOKEN
export GITLAB_API_URL=https://gitlab.example.com/api/v4   # omit for gitlab.com
```

**B. OAuth device flow** (needs a GitLab OAuth application ID)

```bash
export GITLAB_OAUTH_CLIENT_ID=YOUR_APP_ID
zereight-mcp-gitlab auth        # open the printed URL, enter the code
export GITLAB_USE_OAUTH=true    # needed on every later CLI call
```

Do not pass the token with `--token`; arguments are visible in `ps`.

## 3. Read merge requests

| Goal | Command |
| --- | --- |
| List open MRs | `mr list --project-id <path\|id> --state opened` |
| MR summary | `mr view --project-id <p> --mr-iid <n>` |
| Changed file paths only | `mr files --project-id <p> --mr-iid <n>` |
| Full diff | `mr diff --project-id <p> --mr-iid <n>` |
| Review threads | `mr discussions --project-id <p> --mr-iid <n>` |
| MR pipelines | `mr pipelines --project-id <p> --mr-iid <n>` |
| Approval state | `mr approvals --project-id <p> --mr-iid <n>` |
| Anything else | `tool <tool_name> --project-id <p> --args-json '{...}'` |

Prefix every command with `zereight-mcp-gitlab`. Add `--output json` when parsing the result. For large MRs use `mr files` first, then diff only the files you need.

## Required input resolution

Never use placeholders like `<project>` or `42` from this table in a real call.
If the project or MR number is missing, get it from the user, or discover it with `mr list` or `git remote -v`.

## Safety

- Default to read-only: `export GITLAB_PERMISSION_MODE=readonly`. Writes (`mr approve`, `mr merge`, `mr note`, `mr update`, `mr create`) are refused with exit 2.
- Destructive commands need `--yes`. Only add it after the user confirms that exact action in the current message.
- Do not run `mr merge` or `mr approve` unless the user named that action.

## Not covered here

For the MCP tool catalog and workflows, use the `gitlab-mcp` skill. This skill is the CLI route only.
