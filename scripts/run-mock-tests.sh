#!/usr/bin/env bash
# Runs mock/unit tests for CI and local dev (see CONTRIBUTING.md).
set -euo pipefail

EXCLUDE_OPTS=(
  ! -path 'test/clients/*'
  ! -name 'mock-gitlab-server.ts' ! -name 'server-launcher.ts'
  ! -name 'oauth-tests.ts' ! -name 'schema-tests.ts' ! -name 'test-json-schema.ts'
  ! -name 'test-merge-request-approvals.ts'
  # Need a live GitLab token (GITLAB_TOKEN_TEST / TEST_PROJECT_ID)
  ! -name 'remote-auth-tests.ts' ! -name 'test-all-transport-server.ts'
)

run_mock_tests() {
  local parallelism="$1"
  shift
  find test -type f "$@" "${EXCLUDE_OPTS[@]}" -print0 \
    | sort -z \
    | xargs -0 -P "$parallelism" -I {} node --import tsx/esm --test --experimental-test-isolation=none --test-concurrency=1 {}
}

# Pure unit tests — no MCP/mock server processes
run_mock_tests 4 \
  \( -path 'test/utils/*.test.ts' \
  -o -path 'test/path-segment-encoding.test.ts' \
  -o -path 'test/nullish-tool-arguments-schema.test.ts' \
  -o -name '*-schema.test.ts' \
  -o -path 'test/stateless/codec.test.ts' \
  -o -path 'test/stateless/client-id.test.ts' \
  -o -path 'test/stateless/config-ttl.test.ts' \
  -o -path 'test/stateless/session-id.test.ts' \
  -o -path 'test/stateless/callback-proxy.test.ts' \
  -o -path 'test/stateless/consumed-proxy-code-cache.test.ts' \
  -o -path 'test/oauth-startup.test.ts' \
  -o -path 'test/deprecated-env.test.ts' \
  -o -path 'test/oauth-scopes.test.ts' \
  -o -path 'test/oauth-device-flow-tests.ts' \
  -o -path 'test/personal-access-token-file.test.ts' \
  -o -path 'test/config-allowed-groups.test.ts' \
  -o -path 'test/no-proxy-test.ts' \
  -o -path 'test/cli/*.test.ts' \)

# Co-located unit tests for scripts/ helper modules — no MCP/mock server processes
node --import tsx/esm --test --experimental-test-isolation=none scripts/tool-coverage/coverage.test.ts

# Server-spawning suites — sequential to avoid port races and node:test IPC flakes
run_mock_tests 1 \
  \( -name '*.test.ts' -o -name 'test-*.ts' -o -name '*-tests.ts' -o -name '*-test.ts' \) \
  ! -path 'test/utils/*' \
  ! -path 'test/path-segment-encoding.test.ts' \
  ! -path 'test/nullish-tool-arguments-schema.test.ts' \
  ! -name '*-schema.test.ts' \
  ! -path 'test/stateless/codec.test.ts' \
  ! -path 'test/stateless/client-id.test.ts' \
  ! -path 'test/stateless/config-ttl.test.ts' \
  ! -path 'test/stateless/session-id.test.ts' \
  ! -path 'test/stateless/callback-proxy.test.ts' \
  ! -path 'test/stateless/consumed-proxy-code-cache.test.ts' \
  ! -path 'test/oauth-startup.test.ts' \
  ! -path 'test/deprecated-env.test.ts' \
  ! -path 'test/oauth-scopes.test.ts' \
  ! -path 'test/oauth-device-flow-tests.ts' \
  ! -path 'test/personal-access-token-file.test.ts' \
  ! -path 'test/config-allowed-groups.test.ts' \
  ! -path 'test/no-proxy-test.ts' \
  ! -path 'test/cli/*'

tsx test/oauth-tests.ts
