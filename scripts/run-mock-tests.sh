#!/usr/bin/env bash
# Runs mock/unit tests for CI and local dev (see CONTRIBUTING.md).
set -euo pipefail

EXCLUDE_OPTS=(
  ! -path 'test/clients/*'
  ! -name 'mock-gitlab-server.ts' ! -name 'server-launcher.ts'
  ! -name 'oauth-tests.ts' ! -name 'schema-tests.ts' ! -name 'test-json-schema.ts'
  ! -name 'dynamic-api-url-test.ts' ! -name 'dynamic-routing-tests.ts'
  ! -name 'callback-proxy-tests.ts' ! -name 'test-all-transport-server.ts'
  ! -name 'multi-server-test.ts' ! -name 'client-pool-test.ts'
  ! -name 'no-proxy-test.ts' ! -name 'no-proxy-integration-test.ts'
  ! -name 'remote-auth-tests.ts' ! -name 'test-mr-diffs-filter.ts'
  ! -name 'test-mr-file-diffs.ts' ! -name 'test-token-optimizations.ts'
  ! -name 'test-merge-request-approvals.ts' ! -name 'config-allowed-groups.test.ts'
)

run_mock_tests() {
  local parallelism="$1"
  shift
  find test -type f "$@" "${EXCLUDE_OPTS[@]}" -print0 \
    | sort -z \
    | xargs -0 -P "$parallelism" -I {} node --import tsx/esm --test --test-concurrency=1 {}
}

# Pure unit tests — no MCP/mock server processes
run_mock_tests 4 \
  \( -path 'test/utils/*.test.ts' \
  -o -path 'test/path-segment-encoding.test.ts' \
  -o -path 'test/nullish-tool-arguments-schema.test.ts' \
  -o -path 'test/stateless/codec.test.ts' \
  -o -path 'test/stateless/client-id.test.ts' \
  -o -path 'test/stateless/config-ttl.test.ts' \
  -o -path 'test/stateless/session-id.test.ts' \
  -o -path 'test/stateless/callback-proxy.test.ts' \)

# Server-spawning suites — sequential to avoid port races and node:test IPC flakes
run_mock_tests 1 \
  \( -name '*.test.ts' -o -name 'test-*.ts' -o -name '*-tests.ts' -o -name 'remote-auth-simple-test.ts' \) \
  ! -path 'test/utils/*' \
  ! -path 'test/path-segment-encoding.test.ts' \
  ! -path 'test/nullish-tool-arguments-schema.test.ts' \
  ! -path 'test/stateless/codec.test.ts' \
  ! -path 'test/stateless/client-id.test.ts' \
  ! -path 'test/stateless/config-ttl.test.ts' \
  ! -path 'test/stateless/session-id.test.ts' \
  ! -path 'test/stateless/callback-proxy.test.ts'

tsx test/oauth-tests.ts
