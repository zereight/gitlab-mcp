# Better GitLab MCP Server

## @zereight/mcp-gitlab

[![smithery badge](https://smithery.ai/badge/@zereight/gitlab-mcp)](https://smithery.ai/server/@zereight/gitlab-mcp)

GitLab MCP(Model Context Protocol) Server. **Includes bug fixes and improvements over the original GitLab MCP server.**

<a href="https://glama.ai/mcp/servers/7jwbk4r6d7"><img width="380" height="200" src="https://glama.ai/mcp/servers/7jwbk4r6d7/badge" alt="gitlab mcp MCP server" /></a>

## Usage

### Using with Claude App, Cline, Roo Code, Cursor

When using with the Claude App, you need to set up your API key and URLs directly.

```json
{
  "mcpServers": {
    "GitLab communication server": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "your_gitlab_api_url",
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI":"true"
      }
    }
  }
}
```

### Environment Variables


- `GITLAB_PERSONAL_ACCESS_TOKEN`: Your GitLab personal access token.
- `GITLAB_API_URL`: Your GitLab API URL. (Default: `https://gitlab.com/api/v4`)
- `GITLAB_READ_ONLY_MODE`: When set to 'true', restricts the server to only expose read-only operations. Useful for enhanced security or when write access is not needed. Also useful for using with Cursor and it's 40 tool limit.
- `USE_GITLAB_WIKI`: When set to 'true', enables the wiki-related tools (list_wiki_pages, get_wiki_page, create_wiki_page, update_wiki_page, delete_wiki_page). By default, wiki features are disabled.

## Tools 🛠️

+<!-- TOOLS-START -->
1. `create_or_update_file` - Create or update a single file in a GitLab project
2. `search_repositories` - Search for GitLab projects
3. `create_repository` - Create a new GitLab project
4. `get_file_contents` - Get the contents of a file or directory from a GitLab project
5. `push_files` - Push multiple files to a GitLab project in a single commit
6. `create_issue` - Create a new issue in a GitLab project
7. `create_merge_request` - Create a new merge request in a GitLab project
8. `fork_repository` - Fork a GitLab project to your account or specified namespace
9. `create_branch` - Create a new branch in a GitLab project
10. `get_merge_request` - Get details of a merge request
11. `get_merge_request_diffs` - Get the changes/diffs of a merge request
12. `update_merge_request` - Update a merge request
13. `create_note` - Create a new note (comment) to an issue or merge request
14. `mr_discussions` - List discussion items for a merge request
15. `update_merge_request_note` - Modify an existing merge request thread note
16. `list_issues` - List issues in a GitLab project with filtering options
17. `get_issue` - Get details of a specific issue in a GitLab project
18. `update_issue` - Update an issue in a GitLab project
19. `delete_issue` - Delete an issue from a GitLab project
20. `list_issue_links` - List all issue links for a specific issue
21. `get_issue_link` - Get a specific issue link
22. `create_issue_link` - Create an issue link between two issues
23. `delete_issue_link` - Delete an issue link
24. `list_namespaces` - List all namespaces available to the current user
25. `get_namespace` - Get details of a namespace by ID or path
26. `verify_namespace` - Verify if a namespace path exists
27. `get_project` - Get details of a specific project
28. `list_projects` - List projects accessible by the current user
29. `list_labels` - List labels for a project
30. `get_label` - Get a single label from a project
31. `create_label` - Create a new label in a project
32. `update_label` - Update an existing label in a project
33. `delete_label` - Delete a label from a project
34. `list_group_projects` - List projects in a GitLab group with filtering options
35. `list_wiki_pages` - List wiki pages in a GitLab project
36. `get_wiki_page` - Get details of a specific wiki page
37. `create_wiki_page` - Create a new wiki page in a GitLab project
38. `update_wiki_page` - Update an existing wiki page in a GitLab project
39. `delete_wiki_page` - Delete a wiki page from a GitLab project
<!-- TOOLS-END -->
