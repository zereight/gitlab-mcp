# GitLab MCP Test Suite

Tests live under `test/`. `npm test` is `npm run test:all`.

## npm scripts

Commands are the `scripts` entries in `package.json`.

| Script                             | What it runs                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` / `npm run test:all`    | `npm run build`, then `test:mock`, then `test:live`. Live checks skip (exit 0) when the token or `TEST_PROJECT_ID` is unset.                                                                                                                                                                                      |
| `npm run test:mock`                | `bash scripts/run-mock-tests.sh`. Does not build. Suites that spawn `build/index.js` need a prior `npm run build`.                                                                                                                                                                                                |
| `npm run test:live`                | `node test/validate-api.js`. REST smoke check against a real GitLab. Not MCP tool coverage.                                                                                                                                                                                                                       |
| `npm run test:schema`              | `tsx test/schema-tests.ts`, then `tsx test/test-json-schema.ts`, then `node --import tsx/esm --test --experimental-test-isolation=none --test-concurrency=1` on `test/*-schema.test.ts`.                                                                                                                          |
| `npm run test:oauth`               | `tsx test/oauth-tests.ts`, then `node --import tsx/esm --test --experimental-test-isolation=none test/oauth-device-flow-tests.ts`.                                                                                                                                                                                |
| `npm run test:stateless`           | `npm run build`, then those seven files with `node --import tsx/esm --test --experimental-test-isolation=none`: `test/stateless/codec.test.ts`, `client-id.test.ts`, `callback-proxy.test.ts`, `session-id.test.ts`, `session-id-integration.test.ts`, `config-ttl.test.ts`, `consumed-proxy-code-cache.test.ts`. |
| `npm run test:mcp-oauth`           | `npm run build`, then `node --import tsx/esm --test test/mcp-oauth-tests.ts`.                                                                                                                                                                                                                                     |
| `npm run test:remote-auth`         | `npm run build`, then `node --import tsx/esm --test --experimental-test-isolation=none test/remote-auth-simple-test.ts`. Does not run `test/remote-auth-tests.ts`.                                                                                                                                                |
| `npm run test:list-merge-requests` | `npm run build`, then `tsx test/test-list-merge-requests.ts` (mock GitLab, `node:test`). `test:mock` also runs this file.                                                                                                                                                                                         |
| `npm run test:approvals`           | `npm run build`, then `tsx test/test-merge-request-approvals.ts`. Not part of `test:mock`. Needs `GITLAB_PERSONAL_ACCESS_TOKEN` or `GITLAB_TOKEN`, and `GITLAB_PROJECT_ID`. Optional: `MERGE_REQUEST_IID`, `GITLAB_API_URL` (default `https://gitlab.com/api/v4`).                                                |
| `npm run test:consumer-smoke`      | `bash scripts/consumer-install-smoke.sh`. Packs the package, installs it in a temp app, and starts `zereight-mcp-gitlab` with a dummy token. Fails on module-load crashes. Does not compile; `build/` must already exist.                                                                                         |

### `test:mock` order

`scripts/run-mock-tests.sh` does four steps:

1. Parallel (`-P 4`) pure unit files. No MCP process. Each file: `node --import tsx/esm --test --experimental-test-isolation=none --test-concurrency=1`.
2. `node --import tsx/esm --test --experimental-test-isolation=none scripts/tool-coverage/coverage.test.ts`.
3. The remaining suites, one at a time (`-P 1`), same `node --test` command. The script calls this the server-spawning pass (port races and `node:test` IPC flakes). It is selected by filename, so some files here do not start a server.
4. `tsx test/oauth-tests.ts`.

Pass 1 matches, under `test/`, and still subject to the exclude list below:

- `test/utils/*.test.ts`
- `test/cli/*.test.ts`
- `*-schema.test.ts`
- `test/path-segment-encoding.test.ts`
- `test/nullish-tool-arguments-schema.test.ts`
- `test/stateless/codec.test.ts`, `client-id.test.ts`, `config-ttl.test.ts`, `session-id.test.ts`, `callback-proxy.test.ts`, `consumed-proxy-code-cache.test.ts`
- `test/oauth-startup.test.ts`, `test/deprecated-env.test.ts`, `test/oauth-scopes.test.ts`, `test/oauth-device-flow-tests.ts`

Pass 3 matches everything else under `test/` named `*.test.ts`, `test-*.ts`, `*-tests.ts`, or `remote-auth-simple-test.ts`, except pass 1 paths and the exclude list.

`test:oauth` overlaps `test:mock` (`oauth-tests.ts` is step 4; `oauth-device-flow-tests.ts` is pass 1). `test:schema`'s `*-schema.test.ts` files are also pass 1. `schema-tests.ts` and `test-json-schema.ts` are only `test:schema`. `test:stateless`, `test:mcp-oauth`, `test:remote-auth`, and `test:list-merge-requests` re-run files that `test:mock` already runs.

## One file

Same command the mock runner uses:

```bash
node --import tsx/esm --test --experimental-test-isolation=none --test-concurrency=1 test/<file>
```

`test/oauth-tests.ts`, `test/schema-tests.ts`, and `test/test-json-schema.ts` are standalone scripts (`tsx test/<file>`), not `node --test` files. `npm run test:approvals` is the standalone runner for `test/test-merge-request-approvals.ts`.

## Layout

| Path                               | Role                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/*.ts`                        | Most suites: `*.test.ts`, `test-*.ts`, `*-tests.ts`.                                                                                                                       |
| `test/utils/*.test.ts`             | Unit tests. Parallel pass.                                                                                                                                                 |
| `test/utils/mock-gitlab-server.ts` | In-process mock GitLab (`MockGitLabServer`, `findMockServerPort`). Not a test.                                                                                             |
| `test/utils/server-launcher.ts`    | Spawns `build/index.js` for `sse` and `streamable-http`. Not a test.                                                                                                       |
| `test/cli/*.test.ts`               | CLI unit tests. `test/cli/load-config-snapshot.ts` is a helper, not a test.                                                                                                |
| `test/server/*.test.ts`            | `metrics.test.ts`, `request-helpers.test.ts`, `version.test.ts`. Pass 3, because they are `*.test.ts` outside the parallel-pass paths.                                     |
| `test/stateless/*.test.ts`         | Stateless OAuth helpers. The six files named in pass 1 run in parallel; `session-id-integration.test.ts` is pass 3. `npm run test:stateless` runs all seven after a build. |
| `test/clients/`                    | MCP client helpers (`client.ts`, `stdio-client.ts`, `sse-client.ts`, `streamable-http-client.ts`, `custom-header-client.ts`). Not tests.                                   |
| `test/validate-api.js`             | `test:live` only.                                                                                                                                                          |

## Mock GitLab server

Integration suites start `MockGitLabServer` on a free port (`findMockServerPort`), then point the server at `${mockUrl}/api/v4` with a fake token. Stdio suites spawn `node build/index.js` and send a JSON-RPC `tools/call`. HTTP suites use `launchServer` from `test/utils/server-launcher.ts` (`sse` or `streamable-http`) and a client under `test/clients/`. `addMockHandler` stubs a path relative to `/api/v4`. The suite stops the mock server when it finishes.

No live GitLab token is required for `test:mock`.

## Not selected by `test:mock`

`find` skips `test/clients/*`, `mock-gitlab-server.ts`, and `server-launcher.ts` (helpers).

It also skips these names. `oauth-tests.ts` is still step 4 of `test:mock` (`tsx test/oauth-tests.ts`). The others are not run by `test:mock`:

| File                                               | How to run it                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `test/schema-tests.ts`, `test/test-json-schema.ts` | `npm run test:schema`                                                        |
| `test/test-merge-request-approvals.ts`             | `npm run test:approvals`                                                     |
| `test/callback-proxy-tests.ts`                     | No npm script. Run the file yourself.                                        |
| `test/client-pool-test.ts`                         | No npm script.                                                               |
| `test/config-allowed-groups.test.ts`               | No npm script.                                                               |
| `test/dynamic-api-url-test.ts`                     | No npm script.                                                               |
| `test/dynamic-routing-tests.ts`                    | No npm script.                                                               |
| `test/multi-server-test.ts`                        | No npm script.                                                               |
| `test/no-proxy-test.ts`                            | No npm script.                                                               |
| `test/no-proxy-integration-test.ts`                | No npm script.                                                               |
| `test/remote-auth-tests.ts`                        | No npm script. `test:remote-auth` runs `remote-auth-simple-test.ts` instead. |
| `test/test-all-transport-server.ts`                | No npm script.                                                               |
| `test/test-mr-diffs-filter.ts`                     | No npm script.                                                               |
| `test/test-mr-file-diffs.ts`                       | No npm script.                                                               |
| `test/test-token-optimizations.ts`                 | No npm script.                                                               |

`test/validate-api.js` and `test/cli/load-config-snapshot.ts` do not match the `find` globs.

## `test:live` environment

`test/validate-api.js` loads `.env` via `dotenv`, then reads:

| Variable                                                                      | Behavior                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITLAB_TOKEN_TEST`, else `GITLAB_TOKEN`, else `GITLAB_PERSONAL_ACCESS_TOKEN` | Bearer token. If all are unset, the script prints a skip message and exits 0. The token is not printed.                                                                                                                                       |
| `TEST_PROJECT_ID`                                                             | Required. No other project-id variable is read. If unset, skip and exit 0.                                                                                                                                                                    |
| `GITLAB_API_URL`                                                              | Optional. Default `https://gitlab.com`. Trimmed; trailing slashes removed; one trailing `/api/v4` removed; request URLs then append `/api/v4`. `https://gitlab.com` and `https://gitlab.com/api/v4` both hit `https://gitlab.com/api/v4/...`. |

Checks, in order: project, issues, merge requests, branches, pipelines. If a pipeline comes back, also pipeline detail, jobs, and bridges.

```bash
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-xxxx \
GITLAB_API_URL=https://gitlab.com/api/v4 \
TEST_PROJECT_ID=<sandbox project id> \
  npm run test:live
```

Use a throwaway project.

## CI

[`.github/workflows/pr-test.yml`](../.github/workflows/pr-test.yml) (pull requests to `main`, and `workflow_dispatch`):

- `test`: `npm ci --ignore-scripts`, `npm run build`, `npm run check:runtime-deps`, `npm run test:consumer-smoke`, `npm run test:mock`, `npx tsc --noEmit`, `npm run lint`, `npm pack --dry-run`, `npm audit --production`.
- `integration-test`: `docker build` (not on draft PRs, unless dispatched).
- `code-quality`: `npx prettier --check "**/*.{js,ts,json,md}"`, plus warning greps for `console.log` and `TODO` / `FIXME` / `XXX`.
- `docs-build`: `npm run docs:tools` and a diff check on `docs/tools/` and `docs/reference/tool-coverage.md`, then `npm run check:skill-sync` and `mkdocs build --strict`.

[`.github/workflows/live-tests.yml`](../.github/workflows/live-tests.yml) (`push` to `main`, and `workflow_dispatch`) runs `npm run test:live` with `GITLAB_API_URL`, `GITLAB_TOKEN` (secret `GITLAB_TOKEN_TEST`), `GITLAB_PERSONAL_ACCESS_TOKEN`, and `TEST_PROJECT_ID`. It also sets `PROJECT_ID` and `GITLAB_PROJECT_ID` to that same project secret; `validate-api.js` does not read them.

[`.github/workflows/schema-test.yml`](../.github/workflows/schema-test.yml) (pull requests to `main`) runs `npm run test:schema`.

## Adding a test

`scripts/run-mock-tests.sh` only runs files its `find` selects. Name the file `*.test.ts`, `test-*.ts`, or `*-tests.ts` under `test/`, and do not use a name in the exclude list above. A new pure unit test stays on the parallel pass if it is `test/utils/*.test.ts`, `test/cli/*.test.ts`, or `*-schema.test.ts`. Any other new match runs in the sequential pass. A name that matches none of those patterns is not run until the script's `find` is updated.

Tool counts in [tool invocation coverage](../docs/reference/tool-coverage.md) only when the test sends that tool through MCP. `scripts/tool-coverage/coverage.ts` (used by `scripts/generate-tool-coverage.ts`, which `npm run docs:tools` runs) counts a string-literal name in a `callTool*` call (`callTool`, `callToolJson`, `callToolAsync`, `client.callTool`), including `{ name }` only when that object is the first argument. It also counts `params.name` on an object whose `method` is `"tools/call"`, and `{ name }` on the argument right after a `"tools/call"` string. A bare name, a toolset filter, or `callTool(env, toolName)` does not count. `test/tool-description-quality.test.ts` is skipped by that scanner. `test:live` does not count. Regenerate with `npm run docs:tools` (`make tools-docs` runs that) and commit the generated docs.
