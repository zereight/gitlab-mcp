#!/bin/bash
set -e

# Cuts a release through a pull request, so the release commit reaches main
# reviewed. On an up-to-date main it bumps the version on a release/vX.Y.Z
# branch, opens a PR, waits for the required checks and an approving review,
# merges it, tags the merge commit vX.Y.Z, and creates the GitHub release that
# starts the publish workflows. A rerun resumes a release that stopped part way.
# See RELEASING.md for the steps and the environment variables.

# The optional first argument is the `npm version` bump: patch (default),
# minor, or major. It is checked first, so a typo never starts a release.
require_release_type() {
  if [ "$#" -gt 1 ]; then
    echo "❌ Expected at most one argument: patch, minor or major"
  else
    case "${1-patch}" in
      patch|minor|major) return 0 ;;
    esac
    echo "❌ Unknown release type: $1"
  fi
  echo "   Usage: scripts/release.sh [patch|minor|major] (default: patch)"
  exit 1
}

require_release_type "$@"
RELEASE_TYPE="${1-patch}"
RELEASE_TYPE_GIVEN=$#

# Options are environment variables, so the argument stays [patch|minor|major].
# Times are in seconds.
RELEASE_DRY_RUN="${RELEASE_DRY_RUN:-0}"
RELEASE_CHECKS_TIMEOUT="${RELEASE_CHECKS_TIMEOUT:-2700}"
RELEASE_REVIEW_TIMEOUT="${RELEASE_REVIEW_TIMEOUT:-1800}"
RELEASE_POLL_INTERVAL="${RELEASE_POLL_INTERVAL:-30}"
RELEASE_ALLOW_UNREVIEWED="${RELEASE_ALLOW_UNREVIEWED:-0}"
RELEASE_ADMIN_MERGE="${RELEASE_ADMIN_MERGE:-1}"

require_release_options() {
  local name
  for name in RELEASE_CHECKS_TIMEOUT RELEASE_REVIEW_TIMEOUT RELEASE_POLL_INTERVAL; do
    case "${!name}" in
      ''|*[!0-9]*)
        echo "❌ $name must be a whole number of seconds, got: ${!name}"
        exit 1
        ;;
    esac
  done
  for name in RELEASE_DRY_RUN RELEASE_ALLOW_UNREVIEWED RELEASE_ADMIN_MERGE; do
    case "${!name}" in
      0|1) ;;
      *)
        echo "❌ $name must be 0 or 1, got: ${!name}"
        exit 1
        ;;
    esac
  done
}

require_release_options

is_dry_run() {
  [ "$RELEASE_DRY_RUN" = "1" ]
}

if is_dry_run; then
  echo "🔎 Dry run: local steps only. Nothing is pushed, merged, tagged, or released."
fi

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

require_latest_main_branch() {
  local current_branch
  current_branch=$(git branch --show-current 2>/dev/null || echo "")

  if [ "$current_branch" != "main" ]; then
    echo "❌ Release must run from the main branch. Current branch: ${current_branch:-detached HEAD}"
    echo "   Run: git checkout main && git pull origin main"
    exit 1
  fi

  if ! git fetch --tags origin main >/dev/null 2>&1; then
    echo "❌ Failed to fetch origin/main."
    exit 1
  fi

  local head_sha origin_sha
  head_sha=$(git rev-parse HEAD)
  origin_sha=$(git rev-parse origin/main)

  if [ "$head_sha" != "$origin_sha" ]; then
    echo "❌ HEAD is not aligned with the latest origin/main."
    echo "   Local HEAD:  $head_sha"
    echo "   origin/main: $origin_sha"
    if git merge-base --is-ancestor "$head_sha" "$origin_sha" 2>/dev/null; then
      echo "   Local main is behind origin/main. Run: git pull origin main"
    elif git merge-base --is-ancestor "$origin_sha" "$head_sha" 2>/dev/null; then
      echo "   Local main is ahead of origin/main. Push or reset before releasing."
    else
      echo "   Local main has diverged from origin/main. Reconcile before releasing."
    fi
    exit 1
  fi
}

require_latest_main_branch

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

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
  if (pkg.registryType === "oci") {
    // OCI packages carry the version as the image tag, not a version field.
    pkg.identifier = pkg.identifier.replace(/:[^:@/]+$/, `:${version}`);
  } else if (!pkg.identifier || pkg.identifier === packageJson.name) {
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

  # Git tags can outpace npm when publish fails; pin must exist on the registry.
  # Only stable X.Y.Z versions qualify; @next builds are pre-releases.
  if ! npm view "@zereight/mcp-gitlab@${version}" version >/dev/null 2>&1; then
    local npm_pin
    npm_pin=$(
      npm view @zereight/mcp-gitlab versions --json 2>/dev/null | node -e '
const wanted = process.argv[1];
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const versions = JSON.parse(raw).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  const pin = [...versions].reverse().find(
    (v) => v.localeCompare(wanted, undefined, { numeric: true }) < 0
  );
  if (!pin) process.exit(1);
  process.stdout.write(pin);
});
' "$version"
    ) || true
    if [ -n "$npm_pin" ]; then
      echo "⚠️  @$version is not on npm; pinning docs to @$npm_pin instead."
      version="$npm_pin"
    else
      echo "⚠️  Could not resolve an npm-published pin for @$version; leaving docs unchanged."
      return
    fi
  fi

  node - "$version" <<'NODE'
const fs = require("fs");
const path = require("path");
const version = process.argv[2];
const roots = ["README.md", "README.ko.md", "README.zh-CN.md", "README.pt-BR.md", "docs"];

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
  // A pre-release pin (@2.3.5-next.4) is replaced whole, not just its X.Y.Z part.
  const after = before.replace(
    /@zereight\/mcp-gitlab@\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?/g,
    `@zereight/mcp-gitlab@${version}`
  );
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

# Move changelog.d fragments into CHANGELOG.md for this version and delete them.
# No fragments is a no-op, so releases stay equivalent when none are present.
merge_changelog_fragments() {
  local version="$1"
  local previous_tag="$2"
  node scripts/merge-changelog-fragments.mjs \
    --version "$version" \
    --previous-tag "$previous_tag" \
    --repo-url "$REPO_URL"
}

stage_release_paths() {
  git add -u package.json package-lock.json README.md README.ko.md README.zh-CN.md README.pt-BR.md docs CHANGELOG.md
  git add -A changelog.d
  if [ -f server.json ]; then
    git add server.json
  fi
}

# Determine the previous stable tag for changelog. Pre-release tags such as
# v2.4.0-rc.1 are skipped, so notes and the docs pin start from a stable release.
get_previous_tag() {
  local current_tag="$1"
  # Exactly vX.Y.Z. git describe only takes globs, so the excludes drop any
  # suffix (-rc.1, +build.1) and a fourth segment.
  local stable_tag=(--match "v[0-9]*.[0-9]*.[0-9]*" --exclude "v*[!0-9.]*" --exclude "*.*.*.*")
  if [ -n "$current_tag" ]; then
    # Find the tag before the current one
    git describe --tags --abbrev=0 "${stable_tag[@]}" "${current_tag}^" 2>/dev/null || echo ""
  else
    git describe --tags --abbrev=0 "${stable_tag[@]}" 2>/dev/null || echo ""
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

# github-actions[bot] only. dependabot[bot] is also type Bot, but those PRs
# are dependency updates and must stay in the notes.
is_bot_pr() {
  local pr_json="$1"
  local login
  login=$(echo "$pr_json" | jq -r '.user.login // empty' 2>/dev/null || true)
  if [ "$login" = "github-actions[bot]" ]; then
    return 0
  fi
  return 1
}

# The release PR itself (release/vX.Y.Z, "chore(release): vX.Y.Z"). Its merge
# commit mentions #N, so without this a resumed release would list it.
is_release_pr() {
  local pr_json="$1"
  echo "$pr_json" | jq -e '
    ((.title // "") | startswith("chore(release): v"))
    or ((.head.ref // "") | startswith("release/v"))
  ' >/dev/null 2>&1
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

      if is_bot_pr "$pr_data" || is_release_pr "$pr_data"; then
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

# Legacy config flags are removed in v3.0.0 (#815). Releases below that major
# get the notice automatically; v3.0.0+ drops it without another edit.
DEPRECATION_NOTICE_UNTIL_MAJOR=3

deprecation_notice() {
  local version="$1"
  local major="${version%%.*}"

  case "$major" in
    ''|*[!0-9]*) return ;;
  esac

  if [ "$major" -ge "$DEPRECATION_NOTICE_UNTIL_MAJOR" ]; then
    return
  fi

  printf '%s\n' \
    "### ⚠️ Deprecation notice" \
    "Deprecated configuration options (e.g. \`GITLAB_READ_ONLY_MODE\`, \`USE_GITLAB_WIKI\`, and other legacy flags) still work during the grace period, but **they will be removed in v3.0.0**. Please migrate to the replacements described in the pinned issue [#815](https://github.com/zereight/gitlab-mcp/issues/815)."
}

# Generate CHANGELOG-style release notes for previous_tag..end_ref. The end
# is the release commit, which is not HEAD while the release PR is open.
generate_changelog_notes() {
  local version="$1"
  local previous_tag="$2"
  local end_ref="${3:-HEAD}"
  
  local notes="## Changes in v$version\n\n"
  
  # Get all commits since previous tag
  local commits
  if [ -n "$previous_tag" ]; then
    if ! tag_exists "$previous_tag"; then
      echo "❌ Release notes base tag $previous_tag does not exist locally." >&2
      echo "Run git fetch --tags origin and retry." >&2
      exit 1
    fi
    commits=$(git log "$previous_tag".."$end_ref" --oneline)
  else
    commits=$(git log --oneline -50 "$end_ref")
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
      if is_bot_pr "$pr_data" || is_release_pr "$pr_data"; then
        continue
      fi

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
    contributor_range="$previous_tag..$end_ref"
    contributor_limit=10
  else
    contributor_range="$end_ref"
    contributor_limit=20
  fi

  contributors=$(format_pr_contributors "$pr_numbers" "$contributor_range" "$contributor_limit")
  
  if [ -n "$contributors" ]; then
    notes+="\n### Contributors\n$contributors\n"
  fi

  local notice
  notice=$(deprecation_notice "$version")
  if [ -n "$notice" ]; then
    notes+="\n$notice\n"
  fi

  echo -e "$notes"
}

# True when commits after $1 mention a PR (#123). Empty base → recent history.
commits_mention_prs() {
  local since_tag="$1"
  local commits
  if [ -n "$since_tag" ]; then
    commits=$(git log "$since_tag"..HEAD --format="%s" 2>/dev/null || echo "")
  else
    commits=$(git log --oneline -50 --format="%s" 2>/dev/null || echo "")
  fi
  echo "$commits" | grep -qE '#[0-9]+'
}

# ---------------------------------------------------------------------------
# Release pull request
# ---------------------------------------------------------------------------

# Waited for when the branch protection of main can't be read.
DEFAULT_REQUIRED_CHECKS=("test" "code-quality" "docs-build" "schema-tests" "Release notes")

release_branch_name() {
  printf 'release/v%s\n' "$1"
}

# Prints X.Y.Z for release/vX.Y.Z and fails for any other branch name.
release_branch_version() {
  local version="${1#release/v}"
  if [ "$version" = "$1" ] || ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    return 1
  fi
  printf '%s\n' "$version"
}

# Shell-quotes a command for display. A multi-line argument (the release notes
# or the PR body) is shown as a placeholder; the script prints it separately.
format_command() {
  local arg out="" squote="'" escaped="'\\''"
  for arg in "$@"; do
    case "$arg" in
      *$'\n'*) out+=" '<multi-line text, printed above>'" ;;
      "") out+=" ''" ;;
      *[!A-Za-z0-9_./:=@%+,-]*) out+=" '${arg//$squote/$escaped}'" ;;
      *) out+=" $arg" ;;
    esac
  done
  printf '%s\n' "${out# }"
}

# Every write to GitHub goes through here: pushes, the PR, the merge, the tag,
# and the release. RELEASE_DRY_RUN=1 prints the command instead of running it.
run_remote_write() {
  if is_dry_run; then
    echo "🔎 Dry run, would run: $(format_command "$@")"
    return 0
  fi
  "$@"
}

# The lease makes the push fail if the remote branch changed after it was read.
# $2 is its SHA, or empty when the branch must not exist yet.
push_release_branch() {
  local branch="$1" expected_sha="$2"
  run_remote_write git push --force-with-lease="refs/heads/$branch:$expected_sha" \
    origin "refs/heads/$branch:refs/heads/$branch"
}

# Sets RELEASE_PR to the new PR number. The no-changelog label passes the
# "Release notes" check when there were no changelog.d fragments to merge.
create_release_pr() {
  local branch="$1" version="$2" body="$3" url
  local cmd=(gh pr create --base main --head "$branch" --title "chore(release): v$version"
    --label no-changelog --body "$body")
  if is_dry_run; then
    run_remote_write "${cmd[@]}"
    RELEASE_PR="<PR>"
    return 0
  fi
  if ! url=$("${cmd[@]}"); then
    echo "❌ gh pr create failed. Rerun scripts/release.sh to try again."
    exit 1
  fi
  url=$(printf '%s\n' "$url" | tail -n 1)
  RELEASE_PR="${url##*/}"
  case "$RELEASE_PR" in
    ''|*[!0-9]*)
      echo "❌ Could not read the PR number from gh pr create output: $url"
      exit 1
      ;;
  esac
  echo "✅ Opened release PR #$RELEASE_PR: $url"
}

# --subject keeps the merge commit message starting with "chore(release):".
# npm-publish.yml's `next` job skips such pushes, as it skipped the old direct
# release push; GitHub's default "Merge pull request ..." would publish @next.
merge_release_pr() {
  local pr="$1" head_sha="$2" version="$3"
  local cmd=(gh pr merge "$pr" --merge)
  if [ "$RELEASE_ADMIN_MERGE" = "1" ]; then
    cmd+=(--admin)
  fi
  cmd+=(--match-head-commit "$head_sha" --subject "chore(release): v$version (#$pr)")
  run_remote_write "${cmd[@]}"
}

# A local write, but a dry run must not leave a tag behind.
create_release_tag() {
  run_remote_write git tag "$1" "$2"
}

push_release_tag() {
  run_remote_write git push origin "refs/tags/$1"
}

create_github_release() {
  run_remote_write gh release create "$1" --title "$1" --notes "$2" --verify-tag
}

# Wraps @login mentions in code spans, so the release PR notifies nobody. The
# GitHub release keeps the plain mentions.
quote_mentions() {
  printf '%s\n' "$1" | sed -E 's/(^|[^`[:alnum:]_.-])@([A-Za-z0-9][A-Za-z0-9-]*(\[bot\])?)/\1`@\2`/g'
}

release_pr_body() {
  local version="$1" notes="$2"
  printf '%s\n' \
    "Release PR opened by \`scripts/release.sh\` for v$version." \
    "" \
    "After this PR merges, the script tags the merge commit \`v$version\` and creates the GitHub release. Publishing the release starts the npm, Docker Hub, MCP Registry, and MCP Bundle workflows. See RELEASING.md." \
    "" \
    "The script merges this PR once the required checks pass and a reviewer other than the author approves this head commit (normally CodeRabbit)." \
    "" \
    "Mentions below are in code spans, so this PR notifies nobody. The GitHub release lists them as plain mentions." \
    "" \
    "---" \
    ""
  quote_mentions "$notes"
}

# Numbers of open PRs from this repository's release/vX.Y.Z branches, given
# `gh pr list --json number,headRefName,isCrossRepository` output.
open_release_prs() {
  echo "$1" | jq -r '
    .[]
    | select((.headRefName | test("^release/v[0-9]+[.][0-9]+[.][0-9]+$")) and (.isCrossRepository | not))
    | .number'
}

find_open_release_prs() {
  local prs
  if ! prs=$(gh pr list --state open --base main --limit 100 --json number,headRefName,isCrossRepository); then
    echo "❌ Could not list open pull requests with gh." >&2
    return 1
  fi
  open_release_prs "$prs"
}

# The merged PR from release/vX.Y.Z, if any.
find_merged_release_pr() {
  local prs
  if ! prs=$(gh pr list --state merged --base main --head "$(release_branch_name "$1")" --limit 20 \
    --json number,isCrossRepository,mergedAt); then
    echo "❌ Could not list merged pull requests with gh." >&2
    return 1
  fi
  echo "$prs" | jq -r '[.[] | select(.isCrossRepository | not)] | sort_by(.mergedAt) | last | .number // empty'
}

# yes, no (HTTP 404), or unknown when gh fails for another reason. Unknown is
# treated as yes, so a flaky API never creates a second release.
github_release_state() {
  local err
  if err=$(gh api "repos/$REPO_OWNER/$REPO_NAME/releases/tags/$1" 2>&1 >/dev/null); then
    echo yes
  elif [[ "$err" == *"HTTP 404"* ]]; then
    echo no
  else
    echo unknown
  fi
}

# Which step the release of the current version vX.Y.Z is at:
#   $1 tag vX.Y.Z exists locally (yes/no)   $2 tag is on origin (yes/no)
#   $3 GitHub release for the tag (yes/no/unknown)
#   $4 merged release/vX.Y.Z PR number, or empty
#   $5 open release PR number, or empty
release_state() {
  local local_tag="$1" remote_tag="$2" github_release="$3" merged_pr="$4" open_pr="$5"
  if [ "$remote_tag" = no ] && [ "$local_tag" = yes ]; then
    echo push-local-tag
  elif [ "$remote_tag" = no ] && [ -n "$merged_pr" ]; then
    echo tag-merged-pr
  elif [ "$remote_tag" = yes ] && [ "$github_release" = no ]; then
    echo create-missing-release
  elif [ -n "$open_pr" ]; then
    echo resume-open-pr
  elif [ "$remote_tag" = yes ] && [ "$github_release" = unknown ]; then
    # Do not treat a failed lookup as "the release exists": that would skip a
    # missing GitHub release, or bump the next version before publishing this one.
    echo unknown-github-release
  elif [ "$remote_tag" = yes ]; then
    echo bump-after-tag
  else
    echo bump-untagged
  fi
}

# Required check names of main, one per line.
required_check_names() {
  local protection names
  if protection=$(gh api "repos/$REPO_OWNER/$REPO_NAME/branches/main/protection/required_status_checks" 2>/dev/null) &&
    names=$(echo "$protection" | jq -r '[(.checks // [])[].context, (.contexts // [])[]] | unique | .[]' 2>/dev/null) &&
    [ -n "$names" ]; then
    printf '%s\n' "$names"
    return 0
  fi
  echo "⚠️  Could not read the required checks of main; waiting for: ${DEFAULT_REQUIRED_CHECKS[*]}" >&2
  printf '%s\n' "${DEFAULT_REQUIRED_CHECKS[@]}"
}

# pass, "fail <names>", or "pending <names>" for the required checks ($2, one
# per line) in `gh pr checks --json name,bucket` output ($1). A check that has
# not reported yet is pending: --admin would merge past it.
required_checks_state() {
  # A check can report more than once on the same commit: a re-run of a flaky
  # job, or a changelog.yml run cancelled by the next one (cancel-in-progress,
  # e.g. the "opened" and "labeled" events of a new PR). Per check name, a run
  # still in progress means pending; otherwise one pass (or skip) is enough;
  # a name whose runs all failed or were cancelled fails.
  echo "$1" | jq -r --arg required "$2" '
    . as $checks
    | [$required | split("\n")[] | select(. != "")
       | . as $name
       | [$checks[] | select(.name == $name) | .bucket] as $buckets
       | {name: $name,
          state: (if ($buckets | length) == 0 or any($buckets[]; . == "pending") then "pending"
                  elif any($buckets[]; . == "pass" or . == "skipping") then "pass"
                  else "fail" end)}]
    | (map(select(.state == "fail")) | map(.name)) as $failed
    | (map(select(.state == "pending")) | map(.name)) as $pending
    | if ($failed | length) > 0 then "fail " + ($failed | join(", "))
      elif ($pending | length) > 0 then "pending " + ($pending | join(", "))
      else "pass" end'
}

# "approved <logins>", "changes_requested <logins>", or none, for the reviews
# JSON ($1), the PR head SHA ($2), and the PR author ($3). As on GitHub, each
# reviewer's latest approve, request-changes, or dismissed review counts. An
# approval counts only when it was given on the head SHA.
review_approval() {
  echo "$1" | jq -r --arg sha "$2" --arg author "$3" '
    [to_entries[]
     | .value + {order: .key, login: (.value.user.login // "ghost")}
     | select(.login != $author)
     | select(.state == "APPROVED" or .state == "CHANGES_REQUESTED" or .state == "DISMISSED")]
    | group_by(.login) | map(max_by(.order))
    | (map(select(.state == "CHANGES_REQUESTED")) | map(.login)) as $blocking
    | (map(select(.state == "APPROVED" and .commit_id == $sha)) | map(.login)) as $approvers
    | if ($blocking | length) > 0 then "changes_requested " + ($blocking | join(", "))
      elif ($approvers | length) > 0 then "approved " + ($approvers | join(", "))
      else "none" end'
}

fetch_pr_reviews() {
  gh api --paginate "repos/$REPO_OWNER/$REPO_NAME/pulls/$1/reviews?per_page=100" | jq -s 'add // []'
}

package_version_at() {
  git show "$1:package.json" | jq -r '.version'
}

# npm-publish.yml refuses a tag whose package.json doesn't match, so the tag
# must land on a commit of origin/main with package.json at the version.
verify_release_commit() {
  local sha="$1" version="$2" found
  if [ -z "$sha" ] || ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    echo "❌ Release commit ${sha:-(unknown)} for v$version is not available locally."
    echo "   Run git fetch origin main and rerun scripts/release.sh."
    exit 1
  fi
  if ! git merge-base --is-ancestor "$sha" origin/main; then
    echo "❌ Release commit $sha for v$version is not on origin/main."
    exit 1
  fi
  found=$(package_version_at "$sha")
  if [ "$found" != "$version" ]; then
    echo "❌ package.json at $sha is $found, not $version."
    exit 1
  fi
}

# Stops when someone pushed to the release branch after the script read it.
require_pr_head() {
  local pr="$1" head_sha="$2" current
  current=$(gh pr view "$pr" --json headRefOid | jq -r '.headRefOid // empty') || current=""
  if [ -n "$current" ] && [ "$current" != "$head_sha" ]; then
    echo "❌ The head of #$pr moved from $head_sha to $current."
    echo "   Release PR branches are written by scripts/release.sh only. Close #$pr"
    echo "   (gh pr close $pr) and rerun scripts/release.sh to cut the release again."
    exit 1
  fi
}

# --admin also skips the up-to-date rule, so check it here: a release branch
# cut from an older main would merge commits that its notes don't list.
require_release_pr_current() {
  local pr="$1" head_sha="$2"
  git fetch -q origin main
  if ! git merge-base --is-ancestor origin/main "$head_sha"; then
    echo "❌ main moved after the release branch of #$pr was cut."
    echo "   Close #$pr (gh pr close $pr), run git pull origin main, and rerun"
    echo "   scripts/release.sh with the same release type to cut it again."
    exit 1
  fi
}

wait_for_required_checks() {
  local pr="$1" head_sha="$2" required checks state last=""
  local deadline=$((SECONDS + RELEASE_CHECKS_TIMEOUT))
  required=$(required_check_names)
  echo "⏳ Waiting up to $((RELEASE_CHECKS_TIMEOUT / 60)) min for the required checks on #$pr: $(echo "$required" | paste -sd ',' - | sed 's/,/, /g')"
  while true; do
    require_pr_head "$pr" "$head_sha"
    # Right after the PR opens, gh reports "no checks reported" and no JSON.
    checks=$(gh pr checks "$pr" --json name,bucket 2>/dev/null) || true
    if [ -z "$checks" ] || ! state=$(required_checks_state "$checks" "$required" 2>/dev/null); then
      state="pending (no checks reported yet)"
    fi
    case "$state" in
      pass)
        echo "✅ Required checks passed on #$pr."
        return 0
        ;;
      fail\ *)
        echo "❌ Required checks failed on #$pr: ${state#fail }"
        echo "   A flaky check: re-run it in GitHub Actions, then rerun scripts/release.sh to resume."
        echo "   A real failure: fix it on main through a normal PR, close #$pr (gh pr close $pr),"
        echo "   and rerun scripts/release.sh."
        exit 1
        ;;
    esac
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "❌ Required checks on #$pr are still pending after $((RELEASE_CHECKS_TIMEOUT / 60)) min: ${state#pending }"
      echo "   Rerun scripts/release.sh to keep waiting. RELEASE_CHECKS_TIMEOUT sets the wait in seconds."
      exit 1
    fi
    if [ "$state" != "$last" ]; then
      echo "   Waiting for: ${state#pending }"
      last="$state"
    fi
    sleep "$RELEASE_POLL_INTERVAL"
  done
}

wait_for_approval() {
  local pr="$1" head_sha="$2" author="$3" state last=""
  local deadline=$((SECONDS + RELEASE_REVIEW_TIMEOUT))
  echo "⏳ Waiting up to $((RELEASE_REVIEW_TIMEOUT / 60)) min for a review of #$pr that approves $head_sha (normally CodeRabbit)."
  while true; do
    require_pr_head "$pr" "$head_sha"
    state=$(review_approval "$(fetch_pr_reviews "$pr" 2>/dev/null)" "$head_sha" "$author" 2>/dev/null) || state="none"
    case "$state" in
      approved\ *)
        echo "✅ #$pr approved by ${state#approved }."
        return 0
        ;;
    esac
    if [ "$SECONDS" -ge "$deadline" ]; then
      break
    fi
    if [ "$state" != "$last" ]; then
      case "$state" in
        changes_requested\ *) echo "   Changes requested by ${state#changes_requested }; waiting for a new approval." ;;
        *) echo "   No approving review of $head_sha yet." ;;
      esac
      last="$state"
    fi
    sleep "$RELEASE_POLL_INTERVAL"
  done

  case "$state" in
    changes_requested\ *)
      echo "❌ Changes requested on #$pr by ${state#changes_requested }."
      echo "   Resolve or dismiss the review, then rerun scripts/release.sh."
      echo "   RELEASE_ALLOW_UNREVIEWED=1 does not override a review that requests changes."
      exit 1
      ;;
  esac
  if [ "$RELEASE_ALLOW_UNREVIEWED" = "1" ]; then
    echo "⚠️  No approving review of $head_sha on #$pr. RELEASE_ALLOW_UNREVIEWED=1, so merging anyway."
    echo "   OpenSSF Scorecard will count this release commit as unreviewed."
    return 0
  fi
  echo "❌ No approving review of $head_sha on #$pr after $((RELEASE_REVIEW_TIMEOUT / 60)) min."
  echo "   CodeRabbit normally approves on its own; comment \`@coderabbitai review\` on the PR to ask again."
  echo "   Then rerun scripts/release.sh to resume. RELEASE_ALLOW_UNREVIEWED=1 merges without an"
  echo "   approval, and Scorecard then counts the release commit as unreviewed."
  exit 1
}

# The merge commit of a merged PR. GitHub can take a moment to report it.
merged_pr_commit() {
  local pr="$1" tries=0 sha
  while [ "$tries" -lt 5 ]; do
    sha=$(gh pr view "$pr" --json mergeCommit | jq -r '.mergeCommit.oid // empty') || sha=""
    if [ -n "$sha" ]; then
      printf '%s\n' "$sha"
      return 0
    fi
    tries=$((tries + 1))
    sleep "$((RELEASE_POLL_INTERVAL < 5 ? RELEASE_POLL_INTERVAL : 5))"
  done
  echo "❌ Could not read the merge commit of #$pr. Rerun scripts/release.sh to tag it." >&2
  return 1
}

delete_local_release_branch() {
  local branch
  branch=$(release_branch_name "$1")
  if git show-ref -q --verify "refs/heads/$branch"; then
    git branch -q -D "$branch"
  fi
}

# Tags $2 as v$1, pushes the tag, and creates the GitHub release. Publishing
# the release is what starts the npm, Docker, MCP Registry, and MCPB workflows.
publish_release() {
  local version="$1" sha="$2" notes="$3" tag="v$1"
  if ! tag_exists "$tag"; then
    create_release_tag "$tag" "$sha"
  elif [ "$(git rev-parse "$tag^{commit}")" != "$sha" ]; then
    echo "❌ Local tag $tag points at $(git rev-parse "$tag^{commit}"), not the release commit $sha."
    exit 1
  fi
  echo "🏷️  Tagging $sha as $tag."
  push_release_tag "$tag"
  create_github_release "$tag" "$notes"
}

# After the merge: tag the merge commit and release it.
finish_merged_release() {
  local pr="$1" version="$2" notes="$3" merge_sha
  merge_sha=$(merged_pr_commit "$pr")
  git fetch -q origin main
  verify_release_commit "$merge_sha" "$version"
  # Local main follows the merge, so a rerun passes the up-to-date check.
  if [ "$(git branch --show-current)" = main ] && ! git merge -q --ff-only origin/main; then
    echo "⚠️  Could not fast-forward local main to origin/main. Run git pull origin main."
  fi
  publish_release "$version" "$merge_sha" "$notes"
  delete_local_release_branch "$version"
}

# Waits for the required checks and an approving review, merges, then tags and
# releases the merge commit. $1 PR, $2 head SHA, $3 version, $4 notes.
land_release_pr() {
  local pr="$1" head_sha="$2" version="$3" notes="$4" author
  if is_dry_run; then
    echo "🔎 Dry run, would wait up to $((RELEASE_CHECKS_TIMEOUT / 60)) min for the required checks on #$pr,"
    echo "   then up to $((RELEASE_REVIEW_TIMEOUT / 60)) min for a review that approves $head_sha."
    merge_release_pr "$pr" "$head_sha" "$version"
    echo "🔎 Dry run, would run: git fetch origin main, and check that the merge commit's package.json is $version"
    publish_release "$version" "<merge commit of #$pr>" "$notes"
    return 0
  fi

  require_release_pr_current "$pr" "$head_sha"
  wait_for_required_checks "$pr" "$head_sha"
  author=$(gh pr view "$pr" --json author | jq -r '.author.login // empty')
  if [ -z "$author" ]; then
    echo "❌ Could not read the author of #$pr. Rerun scripts/release.sh to resume."
    exit 1
  fi
  wait_for_approval "$pr" "$head_sha" "$author"
  # main may have moved during the wait.
  require_release_pr_current "$pr" "$head_sha"

  if ! merge_release_pr "$pr" "$head_sha" "$version"; then
    echo "❌ Merging #$pr failed. Rerun scripts/release.sh to resume."
    exit 1
  fi
  echo "✅ Merged #$pr."
  finish_merged_release "$pr" "$version" "$notes"
}

print_release_notes() {
  echo "Using version: $NEW_VERSION"
  echo "Generated release notes:"
  echo "---"
  echo "$RELEASE_NOTES"
  echo "---"
}

# Set as the EXIT trap once the bump starts. A dry run always puts the checkout
# back as it found it. A real run only leaves the release branch it was on.
restore_checkout() {
  local branch="$CREATED_RELEASE_BRANCH"
  if is_dry_run; then
    git reset -q --hard || true
    git switch -q main 2>/dev/null || true
    if [ -n "$branch" ] && git show-ref -q --verify "refs/heads/$branch"; then
      git branch -q -D "$branch" || true
    fi
  elif [ -n "$branch" ] && [ "$(git branch --show-current)" = "$branch" ]; then
    git switch -q main || true
  fi
}

# Bumps the version on a new release/vX.Y.Z branch, opens the release PR, and
# lands it. main itself only changes through the PR merge.
cut_release_pr() {
  local body remote_sha
  trap restore_checkout EXIT

  npm version "$RELEASE_TYPE" --no-git-tag-version

  NEW_VERSION=$(node -p "require('./package.json').version")
  echo "New version: $NEW_VERSION"
  if tag_exists "v$NEW_VERSION"; then
    echo "❌ Tag v$NEW_VERSION already exists. Check the tags before releasing."
    exit 1
  fi
  RELEASE_BRANCH=$(release_branch_name "$NEW_VERSION")

  sync_registry_metadata_version "$NEW_VERSION"
  sync_pinned_npx_docs_version "${PREV_TAG#v}"
  preflight_registry_metadata
  build_docs
  merge_changelog_fragments "$NEW_VERSION" "$PREV_TAG"

  # The bump moves to the release branch; main stays at origin/main.
  CREATED_RELEASE_BRANCH="$RELEASE_BRANCH"
  git switch -q -C "$RELEASE_BRANCH"
  stage_release_paths
  git commit -m "chore(release): v$NEW_VERSION"
  RELEASE_SHA=$(git rev-parse HEAD)
  git switch -q main

  RELEASE_NOTES=$(generate_changelog_notes "$NEW_VERSION" "$PREV_TAG" "$RELEASE_SHA")
  print_release_notes

  body=$(release_pr_body "$NEW_VERSION" "$RELEASE_NOTES")
  # Left by an earlier attempt whose PR was closed or never opened.
  remote_sha=$(git ls-remote --heads origin "refs/heads/$RELEASE_BRANCH" | cut -f1)
  if [ -n "$remote_sha" ]; then
    echo "⚠️  origin already has $RELEASE_BRANCH, with no open PR. Replacing it."
  fi
  push_release_branch "$RELEASE_BRANCH" "$remote_sha"
  if is_dry_run; then
    echo "Release PR body:"
    echo "---"
    echo "$body"
    echo "---"
  fi
  create_release_pr "$RELEASE_BRANCH" "$NEW_VERSION" "$body"
  land_release_pr "$RELEASE_PR" "$RELEASE_SHA" "$NEW_VERSION" "$RELEASE_NOTES"
}

ignore_release_type() {
  if [ "$RELEASE_TYPE_GIVEN" -gt 0 ]; then
    echo "⚠️  $1; ignoring release type $RELEASE_TYPE."
  fi
}

# ---------------------------------------------------------------------------
# Where the release is: resume it, or start a new one
# ---------------------------------------------------------------------------

# Check if the current version tag already exists locally
LOCAL_TAG_EXISTS=$(git tag -l "v$CURRENT_VERSION" 2>/dev/null || echo "")
REMOTE_TAG_EXISTS=$(git ls-remote --tags origin "v$CURRENT_VERSION" 2>/dev/null | grep -v "^{}" || echo "")

LOCAL_TAG=no
REMOTE_TAG=no
GITHUB_RELEASE=unknown
MERGED_RELEASE_PR=""
if [ -n "$LOCAL_TAG_EXISTS" ]; then
  LOCAL_TAG=yes
fi
if [ -n "$REMOTE_TAG_EXISTS" ]; then
  REMOTE_TAG=yes
  GITHUB_RELEASE=$(github_release_state "v$CURRENT_VERSION")
else
  MERGED_RELEASE_PR=$(find_merged_release_pr "$CURRENT_VERSION")
fi
OPEN_RELEASE_PR=$(find_open_release_prs)
case "$OPEN_RELEASE_PR" in
  *$'\n'*)
    echo "❌ More than one release PR is open: $(echo "$OPEN_RELEASE_PR" | sed 's/^/#/' | paste -sd ' ' -)"
    echo "   Close all but one and rerun scripts/release.sh."
    exit 1
    ;;
esac

RELEASE_STATE=$(release_state "$LOCAL_TAG" "$REMOTE_TAG" "$GITHUB_RELEASE" "$MERGED_RELEASE_PR" "$OPEN_RELEASE_PR")

PREV_TAG=""
RELEASE_BRANCH=""
CREATED_RELEASE_BRANCH=""
case "$RELEASE_STATE" in
  push-local-tag)
    # Local tag exists but not on remote - push it first
    ignore_release_type "Releasing the existing tag v$CURRENT_VERSION"
    echo "⚠️  Tag v$CURRENT_VERSION exists locally but not on remote. Pushing..."
    NEW_VERSION="$CURRENT_VERSION"
    RELEASE_SHA=$(git rev-parse "v$CURRENT_VERSION^{commit}")
    verify_release_commit "$RELEASE_SHA" "$NEW_VERSION"
    PREV_TAG=$(get_previous_tag "v$CURRENT_VERSION")
    RELEASE_NOTES=$(generate_changelog_notes "$NEW_VERSION" "$PREV_TAG" "$RELEASE_SHA")
    print_release_notes
    publish_release "$NEW_VERSION" "$RELEASE_SHA" "$RELEASE_NOTES"
    ;;

  tag-merged-pr)
    # The release PR merged, but the run stopped before the tag was pushed.
    ignore_release_type "Finishing release PR #$MERGED_RELEASE_PR"
    echo "⚠️  v$CURRENT_VERSION merged in #$MERGED_RELEASE_PR but is not tagged. Tagging its merge commit..."
    NEW_VERSION="$CURRENT_VERSION"
    PREV_TAG=$(get_previous_tag "")
    RELEASE_SHA=$(merged_pr_commit "$MERGED_RELEASE_PR")
    verify_release_commit "$RELEASE_SHA" "$NEW_VERSION"
    RELEASE_NOTES=$(generate_changelog_notes "$NEW_VERSION" "$PREV_TAG" "$RELEASE_SHA")
    print_release_notes
    publish_release "$NEW_VERSION" "$RELEASE_SHA" "$RELEASE_NOTES"
    if ! is_dry_run; then
      delete_local_release_branch "$NEW_VERSION"
    fi
    ;;

  create-missing-release)
    # The tag was pushed, but gh release create did not run or failed.
    ignore_release_type "Creating the missing GitHub release for v$CURRENT_VERSION"
    echo "⚠️  Tag v$CURRENT_VERSION is on the remote but has no GitHub release. Creating it..."
    NEW_VERSION="$CURRENT_VERSION"
    RELEASE_SHA=$(git rev-parse "v$CURRENT_VERSION^{commit}")
    verify_release_commit "$RELEASE_SHA" "$NEW_VERSION"
    PREV_TAG=$(get_previous_tag "v$CURRENT_VERSION")
    RELEASE_NOTES=$(generate_changelog_notes "$NEW_VERSION" "$PREV_TAG" "$RELEASE_SHA")
    print_release_notes
    create_github_release "v$NEW_VERSION" "$RELEASE_NOTES"
    ;;

  resume-open-pr)
    RELEASE_PR="$OPEN_RELEASE_PR"
    PR_JSON=$(gh pr view "$RELEASE_PR" --json headRefName,headRefOid)
    RELEASE_BRANCH=$(echo "$PR_JSON" | jq -r '.headRefName')
    RELEASE_SHA=$(echo "$PR_JSON" | jq -r '.headRefOid')
    if ! NEW_VERSION=$(release_branch_version "$RELEASE_BRANCH"); then
      echo "❌ Open release PR #$RELEASE_PR has an unexpected branch: $RELEASE_BRANCH"
      exit 1
    fi
    ignore_release_type "Resuming release PR #$RELEASE_PR for v$NEW_VERSION"
    echo "⚠️  Release PR #$RELEASE_PR ($RELEASE_BRANCH) is open. Resuming it instead of bumping again..."
    if tag_exists "v$NEW_VERSION"; then
      echo "❌ v$NEW_VERSION is already tagged. Close #$RELEASE_PR (gh pr close $RELEASE_PR) and rerun."
      exit 1
    fi
    git fetch -q origin "refs/heads/$RELEASE_BRANCH"
    if [ "$(package_version_at "$RELEASE_SHA")" != "$NEW_VERSION" ]; then
      echo "❌ package.json on $RELEASE_BRANCH ($RELEASE_SHA) is not $NEW_VERSION."
      exit 1
    fi
    PREV_TAG=$(get_previous_tag "")
    RELEASE_NOTES=$(generate_changelog_notes "$NEW_VERSION" "$PREV_TAG" "$RELEASE_SHA")
    print_release_notes
    land_release_pr "$RELEASE_PR" "$RELEASE_SHA" "$NEW_VERSION" "$RELEASE_NOTES"
    ;;

  unknown-github-release)
    echo "❌ Tag v$CURRENT_VERSION is on the remote, but the GitHub release could not be checked."
    echo "   Rerun scripts/release.sh once gh can reach the releases API. A failed lookup must"
    echo "   not skip a missing release or start the next bump."
    exit 1
    ;;

  bump-after-tag)
    # Tag already exists on remote. Only bump when HEAD actually moved past it —
    # otherwise a second release.sh run creates an empty release (blank notes).
    # After a release, HEAD is the merge commit of the release PR, which is the
    # tagged commit.
    COMMITS_SINCE_TAG=$(git rev-list --count "v${CURRENT_VERSION}..HEAD" 2>/dev/null || echo 0)
    if [ "$COMMITS_SINCE_TAG" = "0" ]; then
      echo "✅ Tag v$CURRENT_VERSION already exists on remote and HEAD has no new commits."
      echo "   Refusing empty $RELEASE_TYPE bump (would produce blank release notes)."
      exit 0
    fi
    if ! commits_mention_prs "v${CURRENT_VERSION}"; then
      echo "❌ Commits since v$CURRENT_VERSION have no PR references (#N)."
      echo "   Refusing release that would produce blank categorized notes."
      exit 1
    fi

    echo "⚠️  Tag v$CURRENT_VERSION already exists on remote. Bumping $RELEASE_TYPE version..."
    PREV_TAG="v$CURRENT_VERSION"
    cut_release_pr
    ;;

  bump-untagged)
    # No existing tag - create new version bump
    PREV_TAG=$(get_previous_tag "")

    if ! commits_mention_prs "$PREV_TAG"; then
      echo "❌ Commits since ${PREV_TAG:-start} have no PR references (#N)."
      echo "   Refusing release that would produce blank categorized notes."
      exit 1
    fi

    cut_release_pr
    ;;
esac

if is_dry_run; then
  echo "🔎 Dry run complete for v$NEW_VERSION. Nothing was pushed, merged, tagged, or released."
  if [ -n "$CREATED_RELEASE_BRANCH" ]; then
    restore_checkout
    echo "   The checkout is back on main and the local branch $CREATED_RELEASE_BRANCH is deleted."
  fi
  exit 0
fi

echo "✅ Release v$NEW_VERSION created and pushed!"
echo "GitHub Actions will now publish to npm and Docker Hub automatically."
