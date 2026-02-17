#!/bin/bash
set -e

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit or stash changes before releasing."
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$PREV_TAG" ]; then
  COMMITS=$(git log --oneline -20)
else
  COMMITS=$(git log "$PREV_TAG"..HEAD --oneline)
fi

npm version patch --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

git add package.json package-lock.json
git commit -m "chore(release): v$NEW_VERSION"

git tag "v$NEW_VERSION"

RELEASE_NOTES="## Changes in v$NEW_VERSION

### Commits
$COMMITS

### Contributors
$(git shortlog -sne HEAD | head -10)
"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI is required. Install with: brew install gh"
  exit 1
fi

gh release create "v$NEW_VERSION" --title "v$NEW_VERSION" --notes "$RELEASE_NOTES"

git push origin HEAD
git push origin "v$NEW_VERSION"

echo "✅ Release v$NEW_VERSION created and pushed!"
echo "GitHub Actions will now publish to npm and Docker Hub automatically."
