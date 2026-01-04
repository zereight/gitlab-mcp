# GitLab MCP Test Suite

This directory contains the test suite for the GitLab MCP server.

## Test Files

### oauth-tests.ts
Comprehensive tests for OAuth2 authentication functionality.

**What it tests:**
- OAuth class instantiation and configuration
- Token storage and retrieval
- Token expiration and validation
- Token file permissions (Unix)
- Port availability checking
- Shared OAuth server concept
- Environment variable configuration
- Support for self-hosted GitLab instances
- Custom redirect URI ports

**Running the tests:**
```bash
npm run test:oauth
```

### readonly-mcp-tests.ts
Integration tests for all read-only MCP tools.

**What it tests:**
- All read-only API operations
- Project management tools
- Issue management tools
- Merge request tools
- Pipeline tools
- File operations
- Commit operations
- Labels, namespaces, users
- Events, milestones, wiki pages

**Running the tests:**
```bash
npm run test:mcp:readonly
```

**Prerequisites:**
- Set `GITLAB_PERSONAL_ACCESS_TOKEN` or `GITLAB_TOKEN` environment variable
- Optionally set `GITLAB_PROJECT_ID` for project-specific tests
- Set `GITLAB_API_URL` if using self-hosted GitLab

### test-list-merge-requests.ts
Tests for the `list_merge_requests` tool with optional `project_id` parameter.

**What it tests:**
- Global merge request listing (without project_id)
- Project-specific merge request listing (with project_id)
- Filter parameters work with both modes
- Response validation and data integrity

**Running the tests:**
```bash
npm run test:list-merge-requests
```

### test-all-transport-server.ts
Tests for different MCP transport protocols (stdio, SSE, streamable-http).

**Running the tests:**
```bash
npm run test:server
```

## Running All Tests

To run the complete test suite:

```bash
npm run test:all
```

This will run:
1. API validation tests
2. Read-only MCP tests
3. OAuth authentication tests

## Environment Variables

### For OAuth Tests
- `GITLAB_OAUTH_CLIENT_ID` - Your OAuth application client ID (optional for basic tests)
- `GITLAB_OAUTH_REDIRECT_URI` - OAuth callback URL (default: `http://127.0.0.1:8888/callback`)
- `GITLAB_API_URL` - GitLab API URL (default: `https://gitlab.com/api/v4`)

### For Integration Tests
- `GITLAB_PERSONAL_ACCESS_TOKEN` - GitLab personal access token (required)
- `GITLAB_PROJECT_ID` - Test project ID (optional but recommended)
- `GITLAB_API_URL` - GitLab API URL (default: `https://gitlab.com/api/v4`)

## Test Results

Test results are saved as JSON files:
- `test-results-oauth.json` - OAuth test results
- `test-results-readonly.json` - Read-only MCP test results

## CI/CD Integration

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitLab CI configuration
test:
  script:
    - npm install
    - npm run build
    - npm run test:all
  variables:
    GITLAB_PERSONAL_ACCESS_TOKEN: $CI_JOB_TOKEN
    GITLAB_PROJECT_ID: $CI_PROJECT_ID
```

## Writing New Tests

### Adding OAuth Tests

Add new test functions to `oauth-tests.ts`:

```typescript
async function testNewFeature(): Promise<void> {
  // Test implementation
  assert(condition, 'Error message');
}

// Register in runOAuthTests()
await runTest('New feature description', testNewFeature);
```

### Adding MCP Tool Tests

Add new tools to the `mcpTools` array in `readonly-mcp-tests.ts`:

```typescript
{
  name: 'new_tool_name',
  category: 'category',
  required: true
}
```

Add parameter setup in `setupToolParameters()` if needed.

## Troubleshooting

### OAuth Tests Failing
- Ensure no OAuth server is running on port 8888
- Check that test token files are cleaned up
- Verify file system permissions for token storage

### Integration Tests Failing
- Verify `GITLAB_PERSONAL_ACCESS_TOKEN` is valid
- Check GitLab API URL is accessible
- Ensure test project exists if `GITLAB_PROJECT_ID` is set
- Check rate limiting on GitLab API

### Permission Errors
- OAuth token files require 0600 permissions on Unix systems
- Ensure write access to test directories
- Windows users: permission tests are automatically skipped

## Test Coverage

Current test coverage:

### OAuth Functionality
- ✅ Class instantiation and configuration
- ✅ Token lifecycle management
- ✅ Expiration handling
- ✅ File permissions
- ✅ Port management
- ✅ Environment configuration
- ⏭️ Full OAuth flow (requires user interaction)
- ⏭️ Token refresh flow (requires valid refresh token)

### MCP Tools
- ✅ All read-only operations
- ⏭️ Write operations (would modify GitLab data)
- ⏭️ Destructive operations (would delete GitLab data)

## Future Improvements

Planned test enhancements:
- [ ] Mock OAuth server for full flow testing
- [ ] Token refresh flow simulation
- [ ] Write operation tests with cleanup
- [ ] Performance benchmarking
- [ ] Concurrent request testing
- [ ] Error recovery testing
- [ ] Network failure simulation
