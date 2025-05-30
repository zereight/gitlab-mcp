#!/bin/bash

if [ -z "$1" ]; then
  echo "Error: docker user name required."
  exit 1
fi

DOCKER_USER=$1
IMAGE_NAME=gitlab-mcp
IMAGE_VERSION=$(jq -r '.version' package.json)

echo "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}"
docker build --platform=linux/arm64 -t "${DOCKER_USER}/${IMAGE_NAME}:latest" .

docker tag "${DOCKER_USER}/${IMAGE_NAME}:latest" "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}"

docker push "${DOCKER_USER}/${IMAGE_NAME}:latest"
docker push "${DOCKER_USER}/${IMAGE_NAME}:${IMAGE_VERSION}"
