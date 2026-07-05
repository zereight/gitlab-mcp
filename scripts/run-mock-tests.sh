#!/usr/bin/env bash
set -euo pipefail

# ponytail: discover mock tests; exclusions = live/schema/manual suites only
find test -type f \( -name '*.test.ts' -o -name 'test-*.ts' -o -name '*-tests.ts' -o -name 'remote-auth-simple-test.ts' \) \
  ! -path 'test/clients/*' \
  ! -name 'mock-gitlab-server.ts' ! -name 'server-launcher.ts' \
  ! -name 'oauth-tests.ts' ! -name 'schema-tests.ts' ! -name 'test-json-schema.ts' \
  ! -name 'dynamic-api-url-test.ts' ! -name 'dynamic-routing-tests.ts' \
  ! -name 'callback-proxy-tests.ts' ! -name 'test-all-transport-server.ts' \
  ! -name 'multi-server-test.ts' ! -name 'client-pool-test.ts' \
  ! -name 'no-proxy-test.ts' ! -name 'no-proxy-integration-test.ts' \
  ! -name 'remote-auth-tests.ts' ! -name 'test-mr-diffs-filter.ts' \
  ! -name 'test-mr-file-diffs.ts' ! -name 'test-token-optimizations.ts' \
  ! -name 'test-merge-request-approvals.ts' ! -name 'config-allowed-groups.test.ts' \
  -print0 | sort -z | xargs -0 node --import tsx/esm --test --test-concurrency=1

tsx test/oauth-tests.ts
