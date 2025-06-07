#!/bin/bash
set -e

# Extract version from package.json
VERSION=$(jq -r .version package.json)

if [ -z "$VERSION" ]; then
  echo "Could not read version from package.json."
  exit 1
fi

# Check if release notes file exists
if [ ! -f RELEASE_NOTES.md ]; then
  echo "RELEASE_NOTES.md file does not exist."
  exit 1
fi

# Generate RELEASE_NOTES.md from CHANGELOG.md for the current version
node <<'EOF'
const fs = require('fs');
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;

const regex = new RegExp(`## \\[${version.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=\\n## |\\n?$)`, 'g');
const match = changelog.match(regex);

if (match && match[0]) {
  fs.writeFileSync('RELEASE_NOTES.md', match[0].trim() + '\n');
  console.log('RELEASE_NOTES.md generated for version', version);
} else {
  console.error('No changelog entry found for version', version);
  process.exit(1);
}
EOF

# Create GitHub release using CLI
gh release create "$VERSION" -t "Release $VERSION" -F RELEASE_NOTES.md