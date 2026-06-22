# GitHub Pages Setup (MkDocs)

The documentation site at [zereight.github.io/gitlab-mcp](https://zereight.github.io/gitlab-mcp/)
is built with **MkDocs Material** and deployed by the
[`Deploy Documentation`](https://github.com/zereight/gitlab-mcp/actions/workflows/docs.yml)
GitHub Actions workflow (`.github/workflows/docs.yml`).

## One-time repository setup

After merging the MkDocs site workflow, enable **GitHub Actions** as the Pages
source (this is **not** stored in git):

1. Open **Settings → Pages** for the repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Do **not** use **Deploy from a branch** (`main` / `/`). That legacy mode runs
   Jekyll over `README.md` and `docs/*.md`, which replaces the MkDocs output
   (no navigation tabs, no search, flat `docs/...html` URLs).

4. Trigger a deploy:
   - **Actions → Deploy Documentation → Run workflow**, or
   - Push a commit that touches `docs/`, `mkdocs.yml`, `requirements-docs.txt`,
     `tools/registry.ts`, `schemas.ts`, or `scripts/generate-tool-docs.ts`.

## How deployment works

| Step | What happens |
|------|----------------|
| Trigger | Push to `main` (paths above) or `workflow_dispatch` |
| Build | `mkdocs build --strict` → `site/` |
| Publish | `actions/deploy-pages` uploads the artifact to GitHub Pages |

Local preview (same theme as the hosted site):

```bash
make serve    # http://127.0.0.1:8000/gitlab-mcp/
make build    # strict build, same as CI
```

## Verify the live site

A successful MkDocs deploy should show:

- **Material theme** navigation tabs (Home, Getting Started, Tools, …)
- Site search in the header
- URLs like `/gitlab-mcp/getting-started/` (not only `/gitlab-mcp/docs/getting-started/index.html`)
- Page source **without** `generator: Jekyll`

If you still see Jekyll or a README-style homepage, Pages is likely still on
**Deploy from a branch**. Switch to **GitHub Actions** and re-run the workflow.

## Forks

Forks need the same **Settings → Pages → GitHub Actions** step. The workflow
file ships with the repo, but GitHub does not enable Actions-based Pages
automatically for every fork.
