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

## Tools 🛠️

1. `create_or_update_file`

   - Create or update a single file in a GitLab project. 📝
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path
     - `file_path` (string): Path to create/update the file
     - `content` (string): File content
     - `commit_message` (string): Commit message
     - `branch` (string): Branch to create/update the file in
     - `previous_path` (optional string): Previous file path when renaming a file
   - Returns: File content and commit details

2. `push_files`

   - Push multiple files in a single commit. 📤
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path
     - `branch` (string): Branch to push to
     - `files` (array): Array of files to push, each with `file_path` and `content` properties
     - `commit_message` (string): Commit message
   - Returns: Updated branch reference

3. `search_repositories`

   - Search for GitLab projects. 🔍
   - Inputs:
     - `search` (string): Search query
     - `page` (optional number): Page number (default: 1)
     - `per_page` (optional number): Results per page (default: 20, max: 100)
   - Returns: Project search results

4. `create_repository`

   - Create a new GitLab project. ➕
   - Inputs:
     - `name` (string): Project name
     - `description` (optional string): Project description
     - `visibility` (optional string): Project visibility level (public, private, internal)
     - `initialize_with_readme` (optional boolean): Initialize with README
   - Returns: Details of the created project

5. `get_file_contents`

   - Get the contents of a file or directory. 📂
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path
     - `file_path` (string): Path to the file/directory
     - `ref` (optional string): Branch, tag, or commit SHA (default: default branch)
   - Returns: File/directory content

6. `create_issue`

   - Create a new issue. 🐛
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path
     - `title` (string): Issue title
     - `description` (string): Issue description
     - `assignee_ids` (optional number[]): Array of assignee IDs
     - `milestone_id` (optional number): Milestone ID
     - `labels` (optional string[]): Array of labels
   - Returns: Details of the created issue

7. `create_merge_request`

   - Create a new merge request. 🚀
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path
     - `title` (string): Merge request title
     - `description` (string): Merge request description
     - `source_branch` (string): Branch with changes
     - `target_branch` (string): Branch to merge into
     - `allow_collaboration` (optional boolean): Allow collaborators to push commits to the source branch
     - `draft` (optional boolean): Create as a draft merge request
   - Returns: Details of the created merge request

8. `fork_repository`

   - Fork a project. 🍴
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path to fork
     - `namespace` (optional string): Namespace to fork into (default: user namespace)
   - Returns: Details of the forked project

9. `create_branch`

   - Create a new branch. 🌿
   - Inputs:
     - `project_id` (string): Project ID or namespace/project_path
     - `name` (string): New branch name
     - `ref` (optional string): Ref to create the branch from (branch, tag, commit SHA, default: default branch)
   - Returns: Created branch reference

10. `get_merge_request`

    - Get details of a merge request. ℹ️
    - Inputs:
      - `project_id` (string): Project ID or namespace/project_path
      - `merge_request_iid` (number): Merge request IID
    - Returns: Merge request details

11. `get_merge_request_diffs`

    - Get changes (diffs) of a merge request. diff
    - Inputs:
      - `project_id` (string): Project ID or namespace/project_path
      - `merge_request_iid` (number): Merge request IID
      - `view` (optional string): Diff view type ('inline' or 'parallel')
    - Returns: Array of merge request diff information

12. `update_merge_request`

    - Update a merge request. 🔄
    - Inputs:
      - `project_id` (string): Project ID or namespace/project_path
      - `merge_request_iid` (number): Merge request IID
      - `title` (optional string): New title
      - `description` (string): New description
      - `target_branch` (optional string): New target branch
      - `state_event` (optional string): Merge request state change event ('close', 'reopen')
      - `remove_source_branch` (optional boolean): Remove source branch after merge
      - `allow_collaboration` (optional boolean): Allow collaborators to push commits to the source branch
    - Returns: Updated merge request details

13. `create_note`
    - Create a new note (comment) to an issue or merge request. 💬
    - Inputs:
      - `project_id` (string): Project ID or namespace/project_path
      - `noteable_type` (string): Type of noteable ("issue" or "merge_request")
      - `noteable_iid` (number): IID of the issue or merge request
      - `body` (string): Note content
    - Returns: Details of the created note

| **`list_projects`** | List accessible projects with rich filtering options 📊 | • Search/filtering: `search`, `owned`, `membership`, `archived`, `visibility`<br>• Features filtering: `with_issues_enabled`, `with_merge_requests_enabled`<br>• Sorting: `order_by`, `sort`<br>• Access control: `min_access_level`<br>• Pagination: `page`, `per_page`, `simple` | Array of projects |
| **`list_labels`** | List all labels for a project with filtering options 🏷️ | • `project_id` (string): Project ID or path<br>• `with_counts` (optional): Include issue and merge request counts<br>• `include_ancestor_groups` (optional): Include ancestor groups<br>• `search` (optional): Filter labels by keyword | Array of labels |
| **`get_label`** | Get a single label from a project 🏷️ | • `project_id` (string): Project ID or path<br>• `label_id` (number/string): Label ID or name<br>• `include_ancestor_groups` (optional): Include ancestor groups | Label details |
| **`create_label`** | Create a new label in a project 🏷️➕ | • `project_id` (string): Project ID or path<br>• `name` (string): Label name<br>• `color` (string): Color in hex format (e.g., "#FF0000")<br>• `description` (optional): Label description<br>• `priority` (optional): Label priority | Created label details |
| **`update_label`** | Update an existing label in a project 🏷️✏️ | • `project_id` (string): Project ID or path<br>• `label_id` (number/string): Label ID or name<br>• `new_name` (optional): New label name<br>• `color` (optional): New color in hex format<br>• `description` (optional): New description<br>• `priority` (optional): New priority | Updated label details |
| **`delete_label`** | Delete a label from a project 🏷️❌ | • `project_id` (string): Project ID or path<br>• `label_id` (number/string): Label ID or name | Success message |

## Environment Variable Configuration

Before running the server, you need to set the following environment variables:

```
GITLAB_PERSONAL_ACCESS_TOKEN=your_gitlab_token
GITLAB_API_URL=your_gitlab_api_url  # Default: https://gitlab.com/api/v4
```

## License

MIT License
