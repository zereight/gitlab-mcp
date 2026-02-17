#!/bin/bash
set -e

# Check if gh CLI is available
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI is required. Install with: brew install gh"
  exit 1
fi

# Get repository info
REPO_URL=$(git remote get-url origin 2>/dev/null | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
REPO_OWNER=$(echo "$REPO_URL" | cut -d'/' -f4)
REPO_NAME=$(echo "$REPO_URL" | cut -d'/' -f5)

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit or stash changes before releasing."
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Determine the previous tag for changelog
get_previous_tag() {
  local current_tag="$1"
  if [ -n "$current_tag" ]; then
    # Find the tag before the current one
    git describe --tags --abbrev=0 "${current_tag}^" 2>/dev/null || echo ""
  else
    git describe --tags --abbrev=0 2>/dev/null || echo ""
  fi
}

# Fetch PR details from GitHub API
fetch_pr_details() {
  local pr_number="$1"
  local response
  response=$(gh api "repos/$REPO_OWNER/$REPO_NAME/pulls/$pr_number" 2>/dev/null)
  if [ -n "$response" ]; then
    echo "$response"
  fi
}

# Get merged PRs since a specific tag
get_merged_prs() {
  local since_tag="$1"
  local prs
  
  if [ -n "$since_tag" ]; then
    # Get commits since the tag
    local commits
    commits=$(git log "$since_tag"..HEAD --oneline --format="%s" 2>/dev/null || echo "")
  else
    local commits
    commits=$(git log --oneline -50 --format="%s" 2>/dev/null || echo "")
  fi
  
  # Extract PR numbers from commit messages (e.g., "feat: add something (#123)")
  echo "$commits" | grep -oE '#[0-9]+' | sed 's/#//' | sort -u
}

# Generate CHANGELOG-style release notes
generate_changelog_notes() {
  local version="$1"
  local previous_tag="$2"
  
  local notes="## Changes in v$version\n\n"
  
  # Get all commits since previous tag
  local commits
  if [ -n "$previous_tag" ]; then
    commits=$(git log "$previous_tag"..HEAD --oneline 2>/dev/null || git log --oneline -50)
  else
    commits=$(git log --oneline -50)
  fi
  
  # Categorize commits by conventional commit prefix
  local features fixes docs refactor chore ci_test build perf other
  
  # Get PR numbers from commits
  local pr_numbers
  pr_numbers=$(echo "$commits" | grep -oE '#[0-9]+' | sed 's/#//' | sort -u | head -20)
  
  # Fetch PR details and categorize
  while IFS= read -r pr_num; do
    if [ -z "$pr_num" ]; then
      continue
    fi
    
    local pr_data
    pr_data=$(gh api "repos/$REPO_OWNER/$REPO_NAME/pulls/$pr_num" 2>/dev/null || echo "")
    
    if [ -n "$pr_data" ]; then
      local pr_title pr_url pr_merged_at
      pr_title=$(echo "$pr_data" | jq -r '.title // empty' 2>/dev/null || echo "")
      pr_url=$(echo "$pr_data" | jq -r '.html_url // empty' 2>/dev/null || echo "")
      
      if [ -n "$pr_title" ] && [ -n "$pr_url" ]; then
        local pr_line="- $pr_title [#$pr_num]($pr_url)"
        
        # Categorize by PR title prefix
        case "$pr_title" in
          feat*|Feat*|FEAT*)
            features+="  $pr_line\n"
            ;;
          fix*|Fix*|FIX*)
            fixes+="  $pr_line\n"
            ;;
          docs*|Docs*|DOCS*)
            docs+="  $pr_line\n"
            ;;
          refactor*|Refactor*|REFACTOR*)
            refactor+="  $pr_line\n"
            ;;
          chore*|Chore*|CHORE*)
            chore+="  $pr_line\n"
            ;;
          ci*|CI*|test*|Test*|TEST*)
            ci_test+="  $pr_line\n"
            ;;
          build*|Build*|BUILD*)
            build+="  $pr_line\n"
            ;;
          perf*|Perf*|PERF*)
            perf+="  $pr_line\n"
            ;;
          *)
            other+="  $pr_line\n"
            ;;
        esac
      fi
    fi
  done <<< "$pr_numbers"
  
  # Add categorized sections if they have content
  if [ -n "$features" ]; then
    notes+="### ✨ Features\n$features\n"
  fi
  
  if [ -n "$fixes" ]; then
    notes+="### 🐛 Bug Fixes\n$fixes\n"
  fi
  
  if [ -n "$perf" ]; then
    notes+="### ⚡ Performance\n$perf\n"
  fi
  
  if [ -n "$refactor" ]; then
    notes+="### ♻️ Refactor\n$refactor\n"
  fi
  
  if [ -n "$docs" ]; then
    notes+="### 📝 Documentation\n$docs\n"
  fi
  
  if [ -n "$build" ]; then
    notes+="### 🔧 Build\n$build\n"
  fi
  
  if [ -n "$ci_test" ]; then
    notes+="### 🔬 CI/Test\n$ci_test\n"
  fi
  
  if [ -n "$chore" ]; then
    notes+="### 🔨 Chore\n$chore\n"
  fi
  
  if [ -n "$other" ]; then
    notes+="### Other Changes\n$other\n"
  fi
  
  # Add contributors section
  notes+="\n### Contributors\n"
  notes+="$(git shortlog -sne HEAD | head -10)\n"
  
  echo -e "$notes"
}

# Check if the current version tag already exists locally
LOCAL_TAG_EXISTS=$(git tag -l "v$CURRENT_VERSION" 2>/dev/null || echo "")
REMOTE_TAG_EXISTS=$(git ls-remote --tags origin "v$CURRENT_VERSION" 2>/dev/null | grep -v "^{}" || echo "")

PREV_TAG=""
if [ -n "$LOCAL_TAG_EXISTS" ] && [ -z "$REMOTE_TAG_EXISTS" ]; then
  # Local tag exists but not on remote - push it first
  echo "⚠️  Tag v$CURRENT_VERSION exists locally but not on remote. Pushing..."
  git push origin "v$CURRENT_VERSION"
  NEW_VERSION="$CURRENT_VERSION"
  PREV_TAG=$(get_previous_tag "v$CURRENT_VERSION")
  
elif [ -n "$LOCAL_TAG_EXISTS" ] && [ -n "$REMOTE_TAG_EXISTS" ]; then
  # Tag already exists on remote - just use it for GitHub release
  echo "⚠️  Tag v$CURRENT_VERSION already exists on remote. Creating GitHub release..."
  NEW_VERSION="$CURRENT_VERSION"
  PREV_TAG=$(get_previous_tag "v$CURRENT_VERSION")
  
else
  # No existing tag - create new version bump
  PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

  npm version patch --no-git-tag-version

  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "New version: $NEW_VERSION"

  git add package.json package-lock.json
  git commit -m "chore(release): v$NEW_VERSION"

  git tag "v$NEW_VERSION"
fi

echo "Using version: $NEW_VERSION"

# Generate CHANGELOG-style release notes
RELEASE_NOTES=$(generate_changelog_notes "$NEW_VERSION" "$PREV_TAG")

echo "Generated release notes:"
echo "---"
echo "$RELEASE_NOTES"
echo "---"

# Create GitHub release with the notes
gh release create "v$NEW_VERSION" --title "v$NEW_VERSION" --notes "$RELEASE_NOTES"

git push origin HEAD
git push origin "v$NEW_VERSION"

echo "✅ Release v$NEW_VERSION created and pushed!"
echo "GitHub Actions will now publish to npm and Docker Hub automatically."
