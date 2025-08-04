#!/bin/bash
git fetch

if [ -z "$1" ]; then
  echo "Error: docker user name required."
  exit 1
fi

git checkout main

DOCKER_USER=$1
IMAGE_NAME=gitlab-mcp
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
IMAGE_VERSION=${IMAGE_VERSION#v}
echo "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}"
npm install && npm run build
docker buildx build --platform linux/arm64,linux/amd64 \
  -t "${DOCKER_USER}/${IMAGE_NAME}:latest" \
  -t "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}" \
  --push \
  .
