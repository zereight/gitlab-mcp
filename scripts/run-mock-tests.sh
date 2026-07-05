#!/usr/bin/env bash
set -euo pipefail

# ponytail: one node --test invocation with concurrency beats 40+ sequential shells
node --import tsx/esm --test --test-concurrency=4 \
  test/path-segment-encoding.test.ts \
  test/remote-auth-simple-test.ts \
  test/dynamic-api-url-allowlist.test.ts \
  test/mcp-oauth-tests.ts \
  test/test-oauth-proxy-rate-limit.ts \
  test/streamable-http-static-token-auth.test.ts \
  test/sse-auth-guard.test.ts \
  test/streamable-http-concurrent-session.test.ts \
  test/streamable-http-unauthenticated-discovery.test.ts \
  test/test-list-merge-requests.ts \
  test/test-list-issues.ts \
  test/test-create-repository.ts \
  test/test-update-project.ts \
  test/test-merge-request-pipelines.ts \
  test/test-list-project-members.ts \
  test/test-download-attachment.ts \
  test/test-upload-markdown.ts \
  test/test-job-artifacts.ts \
  test/test-remote-downloads.ts \
  test/test-deployment-tools.ts \
  test/test-merge-request-approval-state-tools.ts \
  test/test-search-code.ts \
  test/test-tags.ts \
  test/test-protected-branches.ts \
  test/test-toolset-filtering.ts \
  test/test-permission-mode.ts \
  test/test-ci-lint.ts \
  test/test-ci-catalog.ts \
  test/test-todos.ts \
  test/test-auth-retry.ts \
  test/test-issue-description-patch.ts \
  test/test-update-issue-slim.ts \
  test/test-geteffectiveprojectid.ts \
  test/test-get-file-blame.ts \
  test/stateless/codec.test.ts \
  test/stateless/client-id.test.ts \
  test/stateless/callback-proxy.test.ts \
  test/stateless/session-id.test.ts \
  test/stateless/session-id-integration.test.ts \
  test/stateless/config-ttl.test.ts \
  test/utils/tool-args.test.ts \
  test/utils/proxy-client-ip.test.ts \
  test/utils/forwarded-public-base-url.test.ts \
  test/utils/graphql-query.test.ts \
  test/utils/wiki-title.test.ts \
  test/utils/merge-request-position.test.ts \
  test/utils/redact-sensitive.test.ts \
  test/utils/version-check.test.ts \
  test/nullish-tool-arguments-schema.test.ts \
  test/test-ci-variables.ts \
  test/test-dependency-proxy.ts

tsx test/oauth-tests.ts
