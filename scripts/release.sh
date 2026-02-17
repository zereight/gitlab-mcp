#!/bin/bash
set -e

# 1. 현재 버전 확인
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# 2. 패치 버전 bump
npm version patch --no-git-tag-version

# 3. 새 버전 가져오기
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# 4. 이전 태그 이후 커밋 목록 조회
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
if [ -z "$PREV_TAG" ]; then
  # 첫 릴리즈인 경우 모든 커밋
  COMMITS=$(git log --oneline -20)
else
  # 이전 태그부터 현재까지 커밋
  COMMITS=$(git log $PREV_TAG..HEAD --oneline)
fi

# 5. GitHub Release 노트 작성
RELEASE_NOTES="## Changes in v$NEW_VERSION

### Commits
$COMMITS

### Contributors
$(git shortlog -sne HEAD | head -10)
"

# 6. GitHub Release 생성 + tag push
# gh release create v$NEW_VERSION --title "v$NEW_VERSION" --notes "$RELEASE_NOTES"
# 참고: 위 명령은 로컬에서 실행 시 필요. CI에서는 gh cli로 실행.

# 7. 로컬에서는 tag만 push (CI의 release 트리거를 위해)
git push origin v$NEW_VERSION

echo "✅ Release v$NEW_VERSION created and pushed!"
echo "GitHub Actions will now publish to npm and Docker Hub automatically."
