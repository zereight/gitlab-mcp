### Security

- The Docker image pins both Node base images by digest and installs build
  dependencies with `npm ci`, so the build uses exactly `package-lock.json`.
- The docs build and the Star History chart install Python packages from
  hash-pinned requirements files (`pip install --require-hashes`), compiled
  from `requirements-docs.in` and `requirements-star-history.in`. Dependabot
  now updates them.
- The Scorecard workflow reads an optional `SCORECARD_TOKEN` secret so the
  Branch-Protection check can run. Without the secret it uses `GITHUB_TOKEN` as
  before.
