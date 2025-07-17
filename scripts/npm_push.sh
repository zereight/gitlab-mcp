#!/bin/bash
git fetch

git checkout main
IMAGE_VERSION=$(git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*" main)

BASE_VERSION="${IMAGE_VERSION#v}"
version_package=$(jq -r '.version' package.json)
version_package_lock=$(jq -r '.version' package-lock.json)
version_package_lock_version=$(jq -r '.packages[""].version' package-lock.json)

echo "  BASE_VERSION                : $BASE_VERSION"
echo "  package.json                 : $version_package"
echo "  package-lock.json            : $version_package_lock"
echo "  package-lock.packages[\"\"]   : $version_package_lock_version"

if [ "$BASE_VERSION" = "$version_package" ] &&
   [ "$BASE_VERSION" = "$version_package_lock" ] &&
   [ "$BASE_VERSION" = "$version_package_lock_version" ]; then
  echo "✅ version check ok"
else
  echo "❌ invalid version"
  exit 1
fi

git checkout "${IMAGE_VERSION}"
echo "${IMAGE_VERSION}"
npm install && npm run build && npm run deploy
