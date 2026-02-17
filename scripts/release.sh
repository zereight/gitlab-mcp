#!/bin/bash
set -e

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit or stash changes before releasing."
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Check if the current version tag already exists locally
LOCAL_TAG_EXISTS=$(git tag -l "v$CURRENT_VERSION" 2>/dev/null || echo "")
REMOTE_TAG_EXISTS=$(git ls-remote --tags origin "v$CURRENT_VERSION" 2>/dev/null | grep -v "^{}" || echo "")

if [ -n "$LOCAL_TAG_EXISTS" ] && [ -z "$REMOTE_TAG_EXISTS" ]; then
  # Local tag exists but not on remote - push it first
  echo "⚠️  Tag v$CURRENT_VERSION exists locally but not on remote. Pushing..."
  git push origin "v$CURRENT_VERSION"
  NEW_VERSION="$CURRENT_VERSION"
  
  # Get commits since last remote tag or last 20 commits
  LAST_REMOTE_TAG=$(git ls-remote --tags origin "v*" 2>/dev/null | grep -v "^{}" | sort -V | tail -1 | awk '{print $2}' | sed 's|refs/tags/||' | sed 's|\^{||')
  if [ -n "$LAST_REMOTE_TAG" ]; then
    COMMITS=$(git log "$LAST_REMOTE_TAG"..HEAD --oneline)
  else
    COMMITS=$(git log --oneline -20)
  fi
elif [ -n "$LOCAL_TAG_EXISTS" ] && [ -n "$REMOTE_TAG_EXISTS" ]; then
  # Tag already exists on remote - just use it for GitHub release
  echo "⚠️  Tag v$CURRENT_VERSION already exists on remote. Creating GitHub release..."
  NEW_VERSION="$CURRENT_VERSION"
  
  # Get commits since this tag
  COMMITS=$(git log "v$CURRENT_VERSION"..HEAD --oneline 2>/dev/null || git log --oneline -20)
else
  # No existing tag - create new version bump
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
fi

echo "Using version: $NEW_VERSION"

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
