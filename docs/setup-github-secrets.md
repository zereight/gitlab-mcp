# GitHub Secrets Setup Guide

## 1. Navigate to GitHub Repository

1. Go to your `gitlab-mcp` repository on GitHub
2. Click on the Settings tab
3. In the left sidebar, select "Secrets and variables" → "Actions"

## 2. Add Secrets

Click the "New repository secret" button and add the following secrets:

### GITLAB_TOKEN_TEST

- **Name**: `GITLAB_TOKEN_TEST`
- **Value**: Your GitLab Personal Access Token
- Used for integration tests to call the real GitLab API

### TEST_PROJECT_ID

- **Name**: `TEST_PROJECT_ID`
- **Value**: Your test project ID (e.g., `70322092`)
- The GitLab project ID used for testing

### GITLAB_API_URL (Optional)

- **Name**: `GITLAB_API_URL`
- **Value**: `https://gitlab.com`
- Only set this if using a different GitLab instance (default is https://gitlab.com)

## 3. Verify Configuration

To verify your secrets are properly configured:

1. Create a PR or update an existing PR
2. Check the workflow execution in the Actions tab
3. Confirm that the "integration-test" job successfully calls the GitLab API

## Security Best Practices

- Never commit GitLab tokens directly in code
- Grant minimal required permissions to tokens (read_api, write_repository)
- Rotate tokens regularly

## Local Testing

To run integration tests locally:

```bash
export GITLAB_TOKEN_TEST="your-token-here"
export TEST_PROJECT_ID="70322092"
export GITLAB_API_URL="https://gitlab.com"

npm run test:integration
```

⚠️ **Important**: When testing locally, use environment variables and never commit tokens to the repository!
