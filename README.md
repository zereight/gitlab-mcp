# GitLab MCP Server - MR-focused Edition

## Enhanced Merge Request & Vulnerability Management

[![smithery badge](https://smithery.ai/badge/@zereight/gitlab-mcp)](https://smithery.ai/server/@zereight/gitlab-mcp)

GitLab MCP(Model Context Protocol) Server with specialized focus on **Merge Request management and Vulnerability analysis**. This version provides enhanced vulnerability data including file locations, CVE identifiers, package details, and upgrade instructions.

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
        "USE_GITLAB_WIKI": "true"
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
        "nkwd/gitlab-mcp"
      ],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_gitlab_token",
        "GITLAB_API_URL": "https://gitlab.com/api/v4", // Optional, for self-hosted GitLab
        "GITLAB_READ_ONLY_MODE": "false",
        "USE_GITLAB_WIKI": "true"
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

This is a specialized **MR-focused version** with enhanced vulnerability support:

<!-- TOOLS-START -->
1. `get_merge_request` - Get MR metadata - details of a merge request (Either mergeRequestIid or branchName must be provided)
2. `mr_discussions` - List unresolved diff discussions - List discussion items for a merge request filtered for unresolved diff notes (DiffNote type, resolvable=true, resolved=false)
3. `create_merge_request_note` - Add MR notes - Add a reply note to an existing merge request thread
4. `update_merge_request` - Append label in MR - Update a merge request including adding labels (Either mergeRequestIid or branchName must be provided)
5. `get_vulnerabilities_by_ids` - Get vulnerabilities by IDs - Fetch detailed information about multiple vulnerabilities using GraphQL
<!-- TOOLS-END -->

## Enhanced Vulnerability Data 🔍

The `get_vulnerabilities_by_ids` tool provides comprehensive vulnerability information including:

- **File Location**: Exact file paths and line numbers (e.g., `src/frontend/package-lock.json:1117`)
- **Package Details**: Affected package names and versions
- **CVE Information**: CVE identifiers with external reference links
- **Solution Instructions**: Specific upgrade commands and version recommendations
- **Scanner Data**: Information about the security scanner that detected the vulnerability
- **Dependency Context**: Complete dependency chain analysis for vulnerability impact assessment

This enhanced data enables precise vulnerability remediation by providing all the context needed to understand and fix security issues.
