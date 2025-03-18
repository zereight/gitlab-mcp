# Better GitLab MCP Server

## @zereight/mcp-gitlab

[![smithery badge](https://smithery.ai/badge/@zereight/gitlab-mcp)](https://smithery.ai/server/@zereight/gitlab-mcp)

GitLab MCP(Model Context Protocol) Server. **Includes bug fixes and improvements over the original GitLab MCP server.**

<a href="https://glama.ai/mcp/servers/7jwbk4r6d7"><img width="380" height="200" src="https://glama.ai/mcp/servers/7jwbk4r6d7/badge" alt="gitlab mcp MCP server" /></a>

## Usage

### Using with Claude App, Cline, Roo Code

When using with the Claude App, you need to set up your API key and URLs directly.

```json
{
  "mcpServers": {
    "GitLab communication server": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "your_gitlab_api_url"
      }
    }
  }
}
```

### Using with Cursor

When using with Cursor, you can set up environment variables and run the server as follows:

```
env GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token GITLAB_API_URL=your_gitlab_api_url npx @zereight/mcp-gitlab
```

- `GITLAB_PERSONAL_ACCESS_TOKEN`: Your GitLab personal access token.
- `GITLAB_API_URL`: Your GitLab API URL. (Default: `https://gitlab.com/api/v4`)

## Tools Reference 🛠️

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`create_or_update_file`** | Create or update a single file in a GitLab project 📝 | • `project_id` (string): Project ID or path<br>• `file_path` (string): Path to create/update<br>• `content` (string): File content<br>• `commit_message` (string): Commit message<br>• `branch` (string): Target branch<br>• `previous_path` (optional): Previous path when renaming | File content and commit details |
| **`push_files`** | Push multiple files in a single commit 📤 (internally creates a tree and commit) | • `project_id` (string): Project ID or path<br>• `branch` (string): Target branch<br>• `files` (array): Array of files with `file_path` and `content`<br>• `commit_message` (string): Commit message | Updated branch reference |
| **`search_repositories`** | Search for GitLab projects 🔍 | • `search` (string): Search query<br>• `page` (optional): Page number (default: 1)<br>• `per_page` (optional): Results per page (default: 20) | Project search results |
| **`create_repository`** | Create a new GitLab project ➕ | • `name` (string): Project name<br>• `description` (optional): Project description<br>• `visibility` (optional): Visibility level<br>• `initialize_with_readme` (optional): Initialize with README | Created project details |
| **`get_file_contents`** | Get the contents of a file or directory 📂 | • `project_id` (string): Project ID or path<br>• `file_path` (string): Path to file/directory<br>• `ref` (optional): Branch, tag, or commit SHA | File/directory content |
| **`create_issue`** | Create a new issue 🐛 | • `project_id` (string): Project ID or path<br>• `title` (string): Issue title<br>• `description` (string): Issue description<br>• `assignee_ids` (optional): Array of assignee IDs<br>• `milestone_id` (optional): Milestone ID<br>• `labels` (optional): Array of labels | Created issue details |
| **`list_issues`** | List issues in a project with comprehensive filtering options 📋 | • `project_id` (string): Project ID or path<br>• Optional filters: `assignee_id`, `assignee_username`, `author_id`, `author_username`, `confidential`, `created_after/before`, `due_date`, `label_name`, `milestone`, `scope`, `search`, `state`, `updated_after/before`<br>• Pagination: `page`, `per_page` | Array of issues |
| **`get_issue`** | Get details of a specific issue | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Issue IID | Issue details |
| **`update_issue`** | Update an existing issue ✏️ | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Issue IID<br>• Editable fields: `title`, `description`, `assignee_ids`, `labels`, `milestone_id`, `state_event` (close/reopen), `confidential`, `discussion_locked`, `due_date`, `weight` | Updated issue details |
| **`delete_issue`** | Delete an issue | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Issue IID | Success message |
| **`list_issue_links`** | List all links for a specific issue | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Issue IID | Array of linked issues |
| **`get_issue_link`** | Get details of a specific issue link | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Issue IID<br>• `issue_link_id` (number): Link ID | Issue link details |
| **`create_issue_link`** | Create a link between two issues | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Source issue IID<br>• `target_project_id` (string): Target project ID<br>• `target_issue_iid` (number): Target issue IID<br>• `link_type` (optional): Relationship type | Created link details |
| **`delete_issue_link`** | Delete an issue link | • `project_id` (string): Project ID or path<br>• `issue_iid` (number): Issue IID<br>• `issue_link_id` (number): Link ID | Success message |
| **`create_merge_request`** | Create a new merge request 🚀 | • `project_id` (string): Project ID or path<br>• `title` (string): MR title<br>• `description` (string): MR description<br>• `source_branch` (string): Branch with changes<br>• `target_branch` (string): Branch to merge into<br>• `allow_collaboration` (optional): Allow collaborators<br>• `draft` (optional): Create as draft | Created merge request details |
| **`fork_repository`** | Fork a project 🍴 | • `project_id` (string): Project ID or path to fork<br>• `namespace` (optional): Namespace to fork into | Forked project details |
| **`create_branch`** | Create a new branch 🌿 | • `project_id` (string): Project ID or path<br>• `branch` (string): New branch name<br>• `ref` (optional): Reference to create from | Created branch reference |
| **`get_merge_request`** | Get details of a merge request ℹ️ | • `project_id` (string): Project ID or path<br>• `merge_request_iid` (number): MR IID | Merge request details |
| **`get_merge_request_diffs`** | Get changes of a merge request | • `project_id` (string): Project ID or path<br>• `merge_request_iid` (number): MR IID<br>• `view` (optional): Diff view type | Array of merge request diffs |
| **`update_merge_request`** | Update a merge request 🔄 | • `project_id` (string): Project ID or path<br>• `merge_request_iid` (number): MR IID<br>• Editable fields: `title`, `description`, `target_branch`, `assignee_ids`, `labels`, `state_event` (close/reopen), `remove_source_branch`, `squash`, `draft` | Updated merge request details |
| **`create_note`** | Create a comment on an issue or MR 💬 | • `project_id` (string): Project ID or path<br>• `noteable_type` (string): "issue" or "merge_request"<br>• `noteable_iid` (number): IID of the issue or MR<br>• `body` (string): Comment content | Created note details |
| **`list_namespaces`** | List available namespaces | • `search` (optional): Search term<br>• `page` (optional): Page number<br>• `per_page` (optional): Results per page<br>• `owned` (optional): Filter by ownership | Array of namespaces |
| **`get_namespace`** | Get details of a namespace | • `namespace_id` (string): Namespace ID or path | Namespace details |
| **`verify_namespace`** | Check if a namespace exists | • `path` (string): Namespace path to verify | Verification result |
| **`get_project`** | Get details of a specific project | • `project_id` (string): Project ID or path | Project details |
| **`list_projects`** | List accessible projects with rich filtering options 📊 | • Search/filtering: `search`, `owned`, `membership`, `archived`, `visibility`<br>• Features filtering: `with_issues_enabled`, `with_merge_requests_enabled`<br>• Sorting: `order_by`, `sort`<br>• Access control: `min_access_level`<br>• Pagination: `page`, `per_page`, `simple` | Array of projects |

## Environment Variable Configuration

Before running the server, you need to set the following environment variables:

```
GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token
GITLAB_API_URL=your_gitlab_api_url  # Default: https://gitlab.com/api/v4
```

## License

MIT License
