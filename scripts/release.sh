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

git fetch --tags origin >/dev/null 2>&1 || true

tag_exists() {
  git rev-parse -q --verify "refs/tags/$1" >/dev/null
}

sync_registry_metadata_version() {
  local version="$1"

  if [ ! -f server.json ]; then
    return
  fi

  node - "$version" <<'NODE'
const fs = require("fs");
const version = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serverJson = JSON.parse(fs.readFileSync("server.json", "utf8"));

serverJson.version = version;
for (const pkg of serverJson.packages || []) {
  if (!pkg.identifier || pkg.identifier === packageJson.name) {
    pkg.version = version;
  }
}

fs.writeFileSync("server.json", `${JSON.stringify(serverJson, null, 2)}\n`);
NODE
}

# Pin README/docs npx examples to the PREVIOUS stable release, not the version
# being cut right now: a freshly released version has not been proven in the
# wild yet, so new users get the last known-good release by default. Users who
# always want the newest can use @latest (documented in the READMEs).
sync_pinned_npx_docs_version() {
  local version="$1"

  if [ -z "$version" ]; then
    echo "⚠️  No previous release tag found; leaving pinned docs version unchanged."
    return
  fi

  node - "$version" <<'NODE'
const fs = require("fs");
const path = require("path");
const version = process.argv[2];
const roots = ["README.md", "README.ko.md", "README.zh-CN.md", "docs"];

function files(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return root.endsWith(".md") ? [root] : [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(root, entry.name);
    if (entry.isDirectory()) return files(next);
    return entry.isFile() && next.endsWith(".md") ? [next] : [];
  });
}

for (const file of roots.flatMap(files)) {
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(/@zereight\/mcp-gitlab@\d+\.\d+\.\d+/g, `@zereight/mcp-gitlab@${version}`);
  if (after !== before) fs.writeFileSync(file, after);
}
NODE
}

preflight_registry_metadata() {
  if [ ! -f server.json ]; then
    return
  fi

  npm run release:mcp-registry -- --check
}

build_docs() {
  make docs
}

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

format_contributors() {
  local range="$1"
  local limit="$2"
  
  git shortlog -sne "$range" | head -n "$limit" | awk '
    {
      count = $1
      sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", $0)
      name = $0
      email = ""
      if (match(name, /<[^>]+>$/)) {
        email = substr(name, RSTART + 1, RLENGTH - 2)
      }
      sub(/[[:space:]]*<[^>]+>[[:space:]]*$/, "", name)
      mention = name
      if (email ~ /^[0-9]+\+[^@]+@users\.noreply\.github\.com$/) {
        mention = email
        sub(/^[0-9]+\+/, "", mention)
        sub(/@users\.noreply\.github\.com$/, "", mention)
        mention = "@" mention
      } else if (email ~ /^[^@]+@users\.noreply\.github\.com$/) {
        mention = email
        sub(/@users\.noreply\.github\.com$/, "", mention)
        mention = "@" mention
      } else {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", mention)
        gsub(/[^A-Za-z0-9-]/, "-", mention)
        gsub(/-+/, "-", mention)
        gsub(/^-|-$/, "", mention)
        if (mention != "") {
          mention = "@" mention
        }
      }
      if (mention != "") {
        suffix = count == 1 ? "commit" : "commits"
        printf "- %s (%s %s)\n", mention, count, suffix
      }
    }
  '
}

format_pr_contributors() {
  local pr_numbers="$1"
  local fallback_range="$2"
  local limit="$3"

  if [ -z "$pr_numbers" ]; then
    format_contributors "$fallback_range" "$limit"
    return
  fi

  local contributors
  contributors=$(
    while IFS= read -r pr_num; do
      if [ -z "$pr_num" ]; then
        continue
      fi

      local pr_data
      pr_data=$(gh api "repos/$REPO_OWNER/$REPO_NAME/pulls/$pr_num" 2>/dev/null || true)
      if [ -z "$pr_data" ]; then
        continue
      fi

      local login
      login=$(echo "$pr_data" | jq -r '.user.login // empty' 2>/dev/null || true)
      if [ -z "$login" ]; then
        continue
      fi

      printf "%s\t#%s\n" "$login" "$pr_num"
    done <<< "$pr_numbers" |
      awk -F '\t' '
        {
          count[$1]++
          prs[$1] = prs[$1] ? prs[$1] ", " $2 : $2
        }
        END {
          for (login in count) {
            printf "%s\t%s\t%s\n", count[login], login, prs[login]
          }
        }
        ' |
        sort -k1,1nr -k2,2 |
        head -n "$limit" |
      awk -F '\t' '
        {
          suffix = $1 == 1 ? "PR" : "PRs"
          printf "- @%s (%s %s: %s)\n", $2, $1, suffix, $3
        }
      '
  )

  if [ -n "$contributors" ]; then
    echo "$contributors"
  else
    format_contributors "$fallback_range" "$limit"
  fi
}

# Generate CHANGELOG-style release notes
generate_changelog_notes() {
  local version="$1"
  local previous_tag="$2"
  
  local notes="## Changes in v$version\n\n"
  
  # Get all commits since previous tag
  local commits
  if [ -n "$previous_tag" ]; then
    if ! tag_exists "$previous_tag"; then
      echo "❌ Release notes base tag $previous_tag does not exist locally." >&2
      echo "Run git fetch --tags origin and retry." >&2
      exit 1
    fi
    commits=$(git log "$previous_tag"..HEAD --oneline)
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
  
  # Add contributors section (scoped to this release range)
  local contributors
  local contributor_range
  local contributor_limit
  if [ -n "$previous_tag" ]; then
    contributor_range="$previous_tag..HEAD"
    contributor_limit=10
  else
    contributor_range="HEAD"
    contributor_limit=20
  fi

  contributors=$(format_pr_contributors "$pr_numbers" "$contributor_range" "$contributor_limit")
  
  if [ -n "$contributors" ]; then
    notes+="\n### Contributors\n$contributors\n"
  fi
  
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
  
elif [ -n "$REMOTE_TAG_EXISTS" ]; then
  # Tag already exists on remote - bump patch and release new version
  echo "⚠️  Tag v$CURRENT_VERSION already exists on remote. Bumping patch version..."
  PREV_TAG="v$CURRENT_VERSION"

  npm version patch --no-git-tag-version

  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "New version: $NEW_VERSION"

  sync_registry_metadata_version "$NEW_VERSION"
  sync_pinned_npx_docs_version "${PREV_TAG#v}"
  preflight_registry_metadata
  build_docs

  git add -u package.json package-lock.json README.md README.ko.md README.zh-CN.md docs
  if [ -f server.json ]; then
    git add server.json
  fi
  git commit -m "chore(release): v$NEW_VERSION"

  git tag "v$NEW_VERSION"
  
else
  # No existing tag - create new version bump
  PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

  npm version patch --no-git-tag-version

  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "New version: $NEW_VERSION"

  sync_registry_metadata_version "$NEW_VERSION"
  sync_pinned_npx_docs_version "${PREV_TAG#v}"
  preflight_registry_metadata
  build_docs

  git add -u package.json package-lock.json README.md README.ko.md README.zh-CN.md docs
  if [ -f server.json ]; then
    git add server.json
  fi
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

# Push commit and tag before creating release
git push origin HEAD
git push origin "v$NEW_VERSION"

# Create GitHub release with the notes
gh release create "v$NEW_VERSION" --title "v$NEW_VERSION" --notes "$RELEASE_NOTES"

echo "✅ Release v$NEW_VERSION created and pushed!"
echo "GitHub Actions will now publish to npm and Docker Hub automatically."
