#!/bin/bash
git fetch

if [ -z "$1" ]; then
  echo "Error: docker user name required."
  exit 1
fi

git checkout main

DOCKER_USER=$1
IMAGE_NAME=gitlab-mcp
IMAGE_VERSION=$(git describe --tags --abbrev=0)
git checkout "${IMAGE_VERSION}"
IMAGE_VERSION=${IMAGE_VERSION#v}
echo "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}"
docker buildx build --platform linux/arm64,linux/amd64 \
  -t "${DOCKER_USER}/${IMAGE_NAME}:latest" \
  -t "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}" \
  --push \
  .
