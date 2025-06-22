# GitLab MCP Server - AI-Optimized Edition

## An AI-Focused Fork for Better GitLab Integration

This fork of the GitLab MCP server addresses specific challenges when using AI agents with GitLab workflows, particularly around context management and response optimization.

**Key improvements:** Smart pagination for large discussions, streamlined responses, and enhanced vulnerability data.

---

## Why This Fork Was Created

### Context Management Challenge
The original GitLab MCP server can overwhelm AI assistants when dealing with large merge requests containing many discussions (100+ discussions can generate 50,000+ tokens), often resulting in missed comments due to context window limitations.

### Our Approach
- **Smart Pagination**: Discussions are served in manageable chunks with clear metadata
- **Focused Data**: Only essential information is included in responses
- **Enhanced Tools**: Improved vulnerability data and streamlined workflows

---

## Key Improvements

**Response Optimization:**
- Paginated discussions prevent context overflow
- Streamlined data format reduces token usage
- Only unresolved discussions are returned by default

**Enhanced Features:**
- Better vulnerability data with remediation guidance
- Modular TypeScript architecture (500 vs 3,490 lines)
- 6 focused tools instead of 40+ comprehensive ones

**Pagination Example:**
```json
{
  "total_unresolved": 45,
  "current_page": 1,
  "total_pages": 3,
  "discussions": [...]  // 20 discussions per page
}
```

This format helps AI assistants understand when there's more data to retrieve.

---

## Available Tools

**Merge Request Management:**
- `get_merge_request` - Retrieve MR details by ID or branch name
- `get_mr_discussions` - Get paginated unresolved discussions  
- `create_merge_request_note` - Add replies to discussion threads
- `update_merge_request` - Modify MR properties and labels

**Security & Testing:**
- `get_vulnerabilities_by_ids` - Enhanced vulnerability information with fix guidance
- `get_failed_test_cases` - Pipeline test failure analysis

---

## Setup Options

### NPX Installation (Recommended)
```bash
npx @arm5556/gitlab-mcp-ai
```

Configuration for `mcp.json`:
```json
{
  "mcpServers": {
    "gitlab-ai-optimized": {
      "command": "npx",
      "args": ["-y", "@arm5556/gitlab-mcp-ai"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_token_here",
        "GITLAB_API_URL": "https://your-gitlab.com/api/v4"
      }
    }
  }
}
```

### Local Installation
```bash
git clone https://github.com/arm5556/gitlab-mcp.git
cd gitlab-mcp
npm install && npm run build
```

Alternative configuration for `mcp.json`:
```json
{
  "mcpServers": {
    "gitlab-ai-optimized": {
      "command": "node",
      "args": ["./build/src/index.js"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_token_here",
        "GITLAB_API_URL": "https://your-gitlab.com/api/v4"
      }
    }
  }
}
```

### Original Package (For Comparison)
```json
{
  "mcpServers": {
    "gitlab-original": {
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "your_token_here"
      }
    }
  }
}
```

---

## Technical Comparison

| Aspect | This Fork | Original |
|--------|-----------|----------|
| Discussion Handling | Paginated responses | All-at-once |
| Response Size | Optimized for AI | Full GitLab API response |
| Code Size | ~500 lines | ~3,490 lines |
| Tool Count | 6 focused | 40+ comprehensive |
| Architecture | Modular TypeScript | Monolithic |
| Vulnerability Data | Enhanced with fixes | Standard GitLab data |

Both versions serve different use cases - this fork specifically optimizes for AI agent workflows.

---

## Use Cases

This fork may be helpful if you're:
- Using AI assistants for code review workflows
- Working with large merge requests (many discussions)
- Focused on security vulnerability management
- Looking for more efficient token usage with LLM APIs
- Wanting a simpler, more maintainable codebase

---

## Contributing

Contributions are welcome! The modular architecture makes it easier to add features or make improvements. Each component is focused on a specific functionality.

---

## Credits

Built upon the excellent foundation of the [original GitLab MCP server](https://github.com/zereight/mcp-gitlab) by [@zereight](https://github.com/zereight). This fork adapts the codebase for specific AI workflow optimizations.

---

## License

Same license as the original project.
