#!/bin/bash
git fetch

git checkout main
IMAGE_VERSION=$(git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*" main)

git checkout "${IMAGE_VERSION}"
echo "${IMAGE_VERSION}"
npm run build && npm run deploy
