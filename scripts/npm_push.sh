#!/bin/bash
git fetch

git checkout main
IMAGE_VERSION=$(git describe --tags --abbrev=0)

git checkout "${IMAGE_VERSION}"
echo "${IMAGE_VERSION}"
npm run build && npm run deploy
