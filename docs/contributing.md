# Contributing

Thanks for your interest in improving `@zereight/mcp-gitlab`! This page
explains how to set up the project locally, the conventions we follow, and
how to get your change merged.

> **Quick links**
>
> - [Open issues](https://github.com/zereight/gitlab-mcp/issues)
> - [Pull requests](https://github.com/zereight/gitlab-mcp/pulls)
> - [Source — `CONTRIBUTING.md`](https://github.com/zereight/gitlab-mcp/blob/main/CONTRIBUTING.md)
> - [Changelog](https://github.com/zereight/gitlab-mcp/blob/main/CHANGELOG.md)

---

## Ways to contribute

- **Report a bug** — open a [GitHub issue](https://github.com/zereight/gitlab-mcp/issues/new) with steps to reproduce, the client you're using (Claude Code, VS Code, Cursor, etc.), the transport (stdio / SSE / streamable HTTP), and the relevant environment variables.
- **Request a feature** — open an issue describing the GitLab capability you want exposed and why it matters for your workflow.
- **Submit a fix or new tool** — fork the repo and open a pull request (details below).
- **Improve the docs** — this site is generated from `docs/`. PRs that clarify a setup guide, fix a broken link, or add a missing example are very welcome.

## Development setup

### Prerequisites

| Tool           | Version              | Notes                                          |
| -------------- | -------------------- | ---------------------------------------------- |
| Node.js        | **22.21.1**          | Pinned in `.nvmrc`. Use `nvm use` to match.    |
| npm            | bundled with Node 22 |                                                |
| Git            | any recent version   |                                                |
| Python 3.10+   | (only for docs)      | Required if you want to preview the docs site. |
| GitLab account | optional             | Needed only for live integration tests.        |

### Clone, install, build

```bash
git clone https://github.com/zereight/gitlab-mcp.git
cd gitlab-mcp
nvm use            # or: nvm install
npm install
npm run build      # compiles TypeScript to build/
```

### Run the server locally

```bash
# Personal Access Token (stdio transport, the default for local clients)
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-xxxx \
GITLAB_API_URL=https://gitlab.com/api/v4 \
  node build/index.js
```

Watch mode for faster iteration:

```bash
npm run watch          # tsc --watch in one terminal
node build/index.js    # restart this as needed in another
```

See [Environment Variables](configuration/environment-variables.md) for the
complete list of flags the server understands.

## Project structure

```
.
├── index.ts                    # Main MCP server entry point — tool dispatch
├── config.ts                   # Env var + CLI argument parsing
├── schemas.ts                  # Zod schemas for every tool's input
├── tools/registry.ts           # allTools[] + TOOLSET_DEFINITIONS (grouping)
├── auth-retry.ts               # OAuth token refresh on 401
├── oauth.ts                    # Local-browser OAuth2 flow
├── oauth-proxy.ts              # MCP OAuth proxy for remote clients
├── gitlab-client-pool.ts       # Dynamic API URL connection pool
├── stateless/                  # Multi-pod stateless OAuth helpers
├── utils/                      # Shared helpers (schema, tool-args, etc.)
├── test/                       # Mock + live test suites
├── docs/                       # MkDocs source — published to GitHub Pages
├── scripts/                    # Maintenance scripts (release, doc-gen)
└── .github/workflows/          # CI pipelines
```

When adding a new tool:

1. Define the input schema in `schemas.ts` — use `z.object({…}).describe(...)` on each field; the generated docs depend on those descriptions.
2. Register it in `tools/registry.ts` — add to `allTools` with a `name`, `description`, and `inputSchema`, then add the name to the appropriate `TOOLSET_DEFINITIONS` entry.
3. Implement the dispatch case in `index.ts` under the relevant `switch` block.
4. Add a test under `test/`.
5. Regenerate the [Tools Reference](tools/index.md) (`make tools-docs`).

## Testing

```bash
npm run test:mock        # Fast unit + mock-server tests. Run these locally.
npm run test:all         # mock + live; live tests need a real GitLab token.
npm run test:schema      # JSON schema validation.
npm run test:oauth       # OAuth2 flow against the mock server.
npm run test:stateless   # Multi-pod / stateless OAuth helpers.
```

CI runs `test:mock`, `test:oauth`, `test:remote-auth`, and `npx tsc --noEmit`
on every PR. Make sure those pass locally before pushing.

### Live integration tests

```bash
GITLAB_PERSONAL_ACCESS_TOKEN=glpat-xxxx \
GITLAB_API_URL=https://gitlab.com/api/v4 \
  npm run test:live
```

Live tests touch a real GitLab instance — use a throwaway sandbox project,
not anything you care about.

## Code style

| Tool             | Command                | Purpose                      |
| ---------------- | ---------------------- | ---------------------------- |
| Prettier         | `npm run format`       | Formats `*.{js,ts,json,md}`. |
| Prettier (check) | `npm run format:check` | CI gate.                     |
| ESLint           | `npm run lint`         | TypeScript lint.             |
| ESLint (autofix) | `npm run lint:fix`     | Auto-fix where possible.     |
| TypeScript       | `npx tsc --noEmit`     | Type check.                  |

Conventions enforced by CI:

- **No stray `console.log`** in `*.ts` (test files are exempt). Use proper logging.
- **No `TODO` / `FIXME` / `XXX`** comments in committed code — open an issue instead.
- **Strict TypeScript** — the build runs `tsc` with the project's `tsconfig.json` settings.

## Submitting changes

1. **Branch** from `main`. Use a descriptive name:

   - `feat/<short-description>` for new features or new tools
   - `fix/<short-description>` for bug fixes
   - `docs/<short-description>` for docs-only changes
   - `chore/<short-description>` for refactors, deps, CI tweaks

2. **Commit messages** — short, present-tense, lowercase prefix matching the branch type:

   ```
   feat: add list_dependency_proxy_blobs tool
   fix: handle 429 rate-limit on get_merge_request
   docs: clarify OAuth redirect URI for Cursor
   ```

   We don't enforce Conventional Commits strictly, but the changelog
   generator (`npm run changelog`) groups commits by these prefixes.

3. **Pull request** — open against `main`. In the description, include:

   - **What** changed (one paragraph).
   - **Why** — link an issue if there is one.
   - **How tested** — which `npm test` commands ran, and any manual verification with a real MCP client (Claude Code, Cursor, etc.).
   - **Breaking changes** — call them out explicitly.

4. **CI must pass** — the PR workflow runs the mock test suite, type check, lint, Docker build, formatting check, and `npm audit`. Address all real failures; existing "warning" steps (e.g., the TODO grep) are informational.

5. **Review** — a maintainer will review. We try to respond within a few days. Small, focused PRs get merged fastest.

## Documentation contributions

This site is generated from `docs/` with
[MkDocs Material](https://squidfunk.github.io/mkdocs-material/).

```bash
make serve         # preview locally at http://127.0.0.1:8000/gitlab-mcp/
make build         # strict build (same as CI)
make tools-docs    # regenerate per-group tool pages from tools/registry.ts
```

**When changing tools, schemas, or toolsets:**

The per-group [Tools Reference](tools/index.md) pages are **generated** from
`tools/registry.ts` and the Zod schemas. After adding/renaming a tool, run:

```bash
make tools-docs
```

and commit the regenerated files alongside your code change. The docs CI
workflow rebuilds and deploys the site on every push to `main` that touches
`docs/`, `mkdocs.yml`, or `requirements-docs.txt`.

**When changing prose docs:**

Just edit the markdown under `docs/` and run `make serve` to preview.
`mkdocs build --strict` (run by CI) will fail on broken internal links, so
keep cross-references accurate.

## Release process

Releases are cut by maintainers via `scripts/release.sh` and published to
npm via the `npm-publish.yml` workflow. External contributors don't need to
do anything for release — the maintainer will handle versioning and the
changelog.

## Getting help

- **Questions about usage** — open a [GitHub Discussion](https://github.com/zereight/gitlab-mcp/discussions) or a discussion-style issue.
- **Sensitive reports** (security, conduct) — email the maintainers via the address listed in the repo's `package.json` / npm page rather than filing a public issue.

Thanks for contributing!
