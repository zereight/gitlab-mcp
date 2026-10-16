#!/bin/bash
set -euo pipefail

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
fi

if [ ! -f package.json ]; then
  echo "Error: package.json not found. Run this script from the repository root."
  exit 1
fi

if [ ! -f server.json ]; then
  echo "Error: server.json not found. Run mcp-publisher init or add registry metadata first."
  exit 1
fi

read_json() {
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let value=data; for (const key of path) value=value?.[key]; if (value == null) process.exit(1); console.log(value);" "$1" "$2"
}

PACKAGE_NAME=$(read_json package.json "name")
PACKAGE_VERSION=$(read_json package.json "version")
PACKAGE_MCP_NAME=$(read_json package.json "mcpName")
SERVER_NAME=$(read_json server.json "name")
SERVER_VERSION=$(read_json server.json "version")
SERVER_PACKAGE_IDENTIFIER=$(read_json server.json "packages.0.identifier")
SERVER_PACKAGE_VERSION=$(read_json server.json "packages.0.version")
SERVER_OCI_IDENTIFIER=$(node -p "(JSON.parse(require('fs').readFileSync('server.json', 'utf8')).packages || []).find((pkg) => pkg.registryType === 'oci')?.identifier ?? ''")

echo "MCP Registry publish preflight"
echo "  server name        : $SERVER_NAME"
echo "  package name       : $PACKAGE_NAME"
echo "  package version    : $PACKAGE_VERSION"
echo "  oci image          : ${SERVER_OCI_IDENTIFIER:-<none>}"

if [ "$PACKAGE_MCP_NAME" != "$SERVER_NAME" ]; then
  echo "Error: package.json mcpName ($PACKAGE_MCP_NAME) must match server.json name ($SERVER_NAME)."
  exit 1
fi

if [ "$PACKAGE_NAME" != "$SERVER_PACKAGE_IDENTIFIER" ]; then
  echo "Error: package.json name ($PACKAGE_NAME) must match server.json package identifier ($SERVER_PACKAGE_IDENTIFIER)."
  exit 1
fi

if [ "$PACKAGE_VERSION" != "$SERVER_VERSION" ] || [ "$PACKAGE_VERSION" != "$SERVER_PACKAGE_VERSION" ]; then
  echo "Error: package.json version ($PACKAGE_VERSION), server.json version ($SERVER_VERSION), and server package version ($SERVER_PACKAGE_VERSION) must match."
  exit 1
fi

if [ -n "$SERVER_OCI_IDENTIFIER" ]; then
  SERVER_OCI_TAG="${SERVER_OCI_IDENTIFIER##*:}"
  if [ "$SERVER_OCI_TAG" != "$PACKAGE_VERSION" ]; then
    echo "Error: server.json OCI image tag ($SERVER_OCI_TAG) must match package.json version ($PACKAGE_VERSION)."
    exit 1
  fi

  # The registry rejects OCI images whose label does not match the server name.
  DOCKERFILE_SERVER_NAME=$(sed -n 's/^LABEL io\.modelcontextprotocol\.server\.name="\([^"]*\)".*/\1/p' Dockerfile)
  if [ "$DOCKERFILE_SERVER_NAME" != "$SERVER_NAME" ]; then
    echo "Error: Dockerfile label io.modelcontextprotocol.server.name (${DOCKERFILE_SERVER_NAME:-<missing>}) must match server.json name ($SERVER_NAME)."
    exit 1
  fi
fi

if [ "$CHECK_ONLY" = true ]; then
  echo "Preflight passed. Skipping publish because --check was provided."
  exit 0
fi

if ! command -v mcp-publisher >/dev/null 2>&1; then
  echo "Error: mcp-publisher is not installed."
  echo "Install it from the MCP Registry releases or with Homebrew, then run:"
  echo "  mcp-publisher login github"
  echo "  npm run release:mcp-registry"
  exit 1
fi

echo "Publishing server.json to the MCP Registry..."
mcp-publisher publish
