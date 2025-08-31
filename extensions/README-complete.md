# GitLab MCP Extensions

This directory contains extensions for the GitLab MCP server that add critical missing functionality from the original implementation.

## Overview

The GitLab MCP Extensions add approximately 30+ new tools for advanced project management capabilities that are not available in the original GitLab MCP server.

## Extension Categories

### 1. Issue Boards Management
- `list_boards` - List issue boards in a project
- `get_board` - Get details of a specific issue board
- `create_board` - Create a new issue board
- `update_board` - Update an existing issue board
- `delete_board` - Delete an issue board
- `list_board_lists` - List all lists in an issue board
- `create_board_list` - Create a new list in an issue board
- `update_board_list` - Update a list in an issue board
- `delete_board_list` - Delete a list from an issue board
- `get_board_list_issues` - Get issues in a specific board list

### 2. Time Tracking Management
- `add_time_spent` - Add time spent on an issue
- `get_time_tracking` - Get time tracking summary for an issue
- `update_time_estimate` - Update time estimate for an issue
- `list_time_entries` - List time tracking entries for an issue
- `delete_time_entry` - Delete a time tracking entry

### 3. Releases Management
- `list_releases` - List releases in a project
- `get_release` - Get details of a specific release
- `create_release` - Create a new release
- `update_release` - Update an existing release
- `delete_release` - Delete a release
- `create_release_asset` - Create a release asset link
- `update_release_asset` - Update a release asset link
- `delete_release_asset` - Delete a release asset link

### 4. Bulk Operations
- `bulk_update_issues` - Update multiple issues simultaneously
- `bulk_close_issues` - Close multiple issues with optional comment
- `bulk_assign_issues` - Assign or unassign multiple issues to users
- `bulk_label_issues` - Add, remove, or replace labels on multiple issues
- `bulk_update_merge_requests` - Update multiple merge requests simultaneously
- `bulk_export_data` - Export project data in bulk (issues, MRs, milestones)

### 5. Analytics and Reporting
- `get_project_analytics` - Get comprehensive project analytics and metrics
- `get_issue_analytics` - Get issue-specific analytics including velocity and cycle time
- `get_team_performance` - Get team and individual performance metrics
- `get_milestone_analytics` - Get milestone progress and burndown analytics
- `generate_custom_report` - Generate custom reports with specified filters and grouping

### 6. Webhooks Management
- `list_webhooks` - List project webhooks
- `get_webhook` - Get details of a specific webhook
- `create_webhook` - Create a new project webhook
- `update_webhook` - Update an existing webhook
- `delete_webhook` - Delete a project webhook
- `test_webhook` - Test a webhook by triggering a test event

## File Structure

```
extensions/
├── README.md              # Main documentation (see README-complete.md for full version)
├── README-complete.md     # Complete documentation file
├── index.ts              # Main export file
├── schemas.ts            # Zod schema definitions for all extensions
├── tools.ts              # Tool definitions for MCP server
├── handlers.ts           # Handler implementations (to be implemented)
├── types.ts              # TypeScript type definitions
```

## Integration

The extensions are designed to integrate seamlessly with the existing GitLab MCP server without disrupting current functionality. They follow the same patterns and conventions as the original implementation.

## Development Status

- ✅ **Setup Complete**: Extension development environment and structure
- ⏳ **In Progress**: Handler implementations (subsequent tasks)
- ⏳ **Pending**: Integration with main server
- ⏳ **Pending**: Testing and validation

## Requirements Covered

This extension implementation addresses all requirements from the GitLab MCP Extensions specification:

- **Requirement 1**: Issue Boards Management ✅
- **Requirement 2**: Issue Board Lists Management ✅  
- **Requirement 3**: Time Tracking Management ✅
- **Requirement 4**: Releases Management ✅
- **Requirement 5**: Bulk Operations ✅
- **Requirement 6**: Advanced Analytics and Reporting ✅
- **Requirement 7**: Workflow Automation (Future) ⏳
- **Requirement 8**: Webhooks and Integration Management ✅

## Architecture

The extensions follow a modular architecture:

1. **Schemas** (`schemas.ts`) - Zod validation schemas for all API inputs/outputs
2. **Tools** (`tools.ts`) - MCP tool definitions with JSON schemas
3. **Handlers** (`handlers.ts`) - Implementation logic for each tool
4. **Types** (`types.ts`) - TypeScript type definitions
5. **Index** (`index.ts`) - Main export aggregator

## Usage

The extensions will be automatically integrated with the main GitLab MCP server once the handlers are implemented. Each tool can be called through the MCP protocol with the appropriate parameters as defined in the schemas.

## Next Steps

1. Implement handler functions for each tool category
2. Integrate extensions with main GitLab MCP server
3. Add comprehensive error handling
4. Implement testing suite
5. Add workflow automation capabilities

## Contributing

When implementing handlers, follow these guidelines:

1. Use the existing `ExtensionHandlerContext` interface
2. Follow the same error handling patterns as the main server
3. Validate inputs using the provided Zod schemas
4. Return responses in the standard MCP format
5. Add appropriate logging for debugging

## API Coverage

The extensions provide comprehensive coverage of GitLab's REST API endpoints that were missing from the original implementation:

- **Boards API**: `/projects/:id/boards/*`
- **Time Tracking API**: `/projects/:id/issues/:issue_iid/time_stats`
- **Releases API**: `/projects/:id/releases/*`
- **Bulk Operations**: Multiple API endpoints with batch processing
- **Analytics**: Custom analytics aggregation from multiple endpoints
- **Webhooks API**: `/projects/:id/hooks/*`