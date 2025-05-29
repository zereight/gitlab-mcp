# Better GitLab MCP Server

## @zereight/mcp-gitlab

[![smithery badge](https://smithery.ai/badge/@zereight/gitlab-mcp)](https://smithery.ai/server/@zereight/gitlab-mcp)

GitLab MCP(Model Context Protocol) Server. **Includes bug fixes and improvements over the original GitLab MCP server.**

<a href="https://glama.ai/mcp/servers/7jwbk4r6d7"><img width="380" height="200" src="https://glama.ai/mcp/servers/7jwbk4r6d7/badge" alt="gitlab mcp MCP server" /></a>

## Usage

### Using with Claude App, Cline, Roo Code, Cursor

When using with the Claude App, you need to set up your API key and URLs directly.

#### npx

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
        "USE_GITLAB_WIKI": "false",
        "USE_MILESTONE": "false"
      }
    }
  }
}
```

#### Docker

```json
{
  "mcpServers": {
    "GitLab communication server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITLAB_PERSONAL_ACCESS_TOKEN",
        "-e",
        "GITLAB_API_URL",
        "-e",
        "GITLAB_READ_ONLY_MODE",
        "-e",
        "USE_GITLAB_WIKI",
        "-e",
        "USE_MILESTONE",
        "iwakitakuma/gitlab-mcp"
      ],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "https://gitlab.com/api/v4", // Optional, for self-hosted GitLab
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI": "true",
        "USE_MILESTONE": "true"
      }
    }
  }
}
```

#### Docker Image Push

```shell
$ sh scripts/image_push.sh docker_user_name
```

### Environment Variables

- `GITLAB_PERSONAL_ACCESS_TOKEN`: Your GitLab personal access token.
- `GITLAB_API_URL`: Your GitLab API URL. (Default: `https://gitlab.com/api/v4`)
- `GITLAB_READ_ONLY_MODE`: When set to 'true', restricts the server to only expose read-only operations. Useful for enhanced security or when write access is not needed. Also useful for using with Cursor and it's 40 tool limit.
- `USE_GITLAB_WIKI`: When set to 'true', enables the wiki-related tools (list_wiki_pages, get_wiki_page, create_wiki_page, update_wiki_page, delete_wiki_page). By default, wiki features are disabled.
- `USE_MILESTONE`: When set to 'true', enables the milestone-related tools (list_milestones, get_milestone, create_milestone, edit_milestone, delete_milestone, get_milestone_issue, get_milestone_merge_requests, promote_milestone, get_milestone_burndown_events). By default, milestone features are disabled.

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
10. `get_merge_request` - Get details of a merge request (Either mergeRequestIid or branchName must be provided)
11. `get_merge_request_diffs` - Get the changes/diffs of a merge request (Either mergeRequestIid or branchName must be provided)
12. `update_merge_request` - Update a merge request (Either mergeRequestIid or branchName must be provided)
13. `create_note` - Create a new note (comment) to an issue or merge request
14. `create_merge_request_thread` - Create a new thread on a merge request
15. `mr_discussions` - List discussion items for a merge request
16. `update_merge_request_note` - Modify an existing merge request thread note
17. `create_merge_request_note` - Add a new note to an existing merge request thread
18. `update_issue_note` - Modify an existing issue thread note
19. `create_issue_note` - Add a new note to an existing issue thread
20. `list_issues` - List issues in a GitLab project with filtering options
21. `get_issue` - Get details of a specific issue in a GitLab project
22. `update_issue` - Update an issue in a GitLab project
23. `delete_issue` - Delete an issue from a GitLab project
24. `list_issue_links` - List all issue links for a specific issue
25. `list_issue_discussions` - List discussions for an issue in a GitLab project
26. `get_issue_link` - Get a specific issue link
27. `create_issue_link` - Create an issue link between two issues
28. `delete_issue_link` - Delete an issue link
29. `list_namespaces` - List all namespaces available to the current user
30. `get_namespace` - Get details of a namespace by ID or path
31. `verify_namespace` - Verify if a namespace path exists
32. `get_project` - Get details of a specific project
33. `list_projects` - List projects accessible by the current user
34. `list_labels` - List labels for a project
35. `get_label` - Get a single label from a project
36. `create_label` - Create a new label in a project
37. `update_label` - Update an existing label in a project
38. `delete_label` - Delete a label from a project
39. `list_group_projects` - List projects in a GitLab group with filtering options
40. `list_wiki_pages` - List wiki pages in a GitLab project
41. `get_wiki_page` - Get details of a specific wiki page
42. `create_wiki_page` - Create a new wiki page in a GitLab project
43. `update_wiki_page` - Update an existing wiki page in a GitLab project
44. `delete_wiki_page` - Delete a wiki page from a GitLab project
45. `get_repository_tree` - Get the repository tree for a GitLab project (list files and directories)
46. `list_pipelines` - List pipelines in a GitLab project with filtering options
47. `get_pipeline` - Get details of a specific pipeline in a GitLab project
48. `list_pipeline_jobs` - List all jobs in a specific pipeline
49. `get_pipeline_job` - Get details of a GitLab pipeline job number
50. `get_pipeline_job_output` - Get the output/trace of a GitLab pipeline job number
51. `list_merge_requests` - List merge requests in a GitLab project with filtering options
52. `list_milestones` - List milestones in a GitLab project with filtering options
53. `get_milestone` - Get details of a specific milestone
54. `create_milestone` - Create a new milestone in a GitLab project
55. `edit_milestone ` - Edit an existing milestone in a GitLab project
56. `delete_milestone` - Delete a milestone from a GitLab project
57. `get_milestone_issue` - Get issues associated with a specific milestone
58. `get_milestone_merge_requests` - Get merge requests associated with a specific milestone
59. `promote_milestone` - Promote a milestone to the next stage
60. `get_milestone_burndown_events` - Get burndown events for a specific milestone
<!-- TOOLS-END -->
