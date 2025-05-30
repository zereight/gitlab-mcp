# PR Validation Guide

## Overview

All Pull Requests are now automatically tested and validated. Manual testing is no longer required!

## Automated Validation Items

### 1. Build and Type Check

- TypeScript compilation success
- No type errors

### 2. Testing

- **Unit Tests**: API endpoints, error handling, authentication, etc.
- **Integration Tests**: Real GitLab API integration (when environment variables are set)
- **Code Coverage**: Test coverage report generation

### 3. Code Quality

- **ESLint**: Code style and potential bug detection
- **Prettier**: Code formatting consistency
- **Security Audit**: npm package vulnerability scanning

### 4. Docker Build

- Dockerfile build success
- Container startup validation

### 5. Node.js Version Compatibility

- Tested across Node.js 18.x, 20.x, and 22.x

## GitHub Secrets Setup (Optional)

To enable integration tests, configure these secrets:

1. `GITLAB_TOKEN_TEST`: GitLab Personal Access Token
2. `TEST_PROJECT_ID`: Test GitLab project ID
3. `GITLAB_API_URL`: GitLab API URL (default: https://gitlab.com)

## Running Validation Locally

You can run validation locally before submitting a PR:

```bash
# Run all validations
./scripts/validate-pr.sh

# Run individual validations
npm run test           # All tests
npm run test:unit      # Unit tests only
npm run test:coverage  # With coverage
npm run lint          # ESLint
npm run format:check  # Prettier check
```

## PR Status Checks

When you create a PR, these checks run automatically:

- ✅ test (18.x)
- ✅ test (20.x)
- ✅ test (22.x)
- ✅ integration-test
- ✅ code-quality
- ✅ coverage

All checks must pass before merging is allowed.

## Troubleshooting

### Test Failures

1. Check the failed test in the PR's "Checks" tab
2. Review specific error messages in the logs
3. Run the test locally to debug

### Formatting Errors

```bash
npm run format      # Auto-fix formatting
npm run lint:fix    # Auto-fix ESLint issues
```

### Type Errors

```bash
npx tsc --noEmit    # Run type check only
```

## Dependabot Auto-merge

- Minor and patch updates are automatically merged
- Major updates require manual review
