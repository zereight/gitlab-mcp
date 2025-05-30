#!/bin/bash

# PR Validation Script
# This script runs all necessary checks before merging a PR

set -e

echo "🔍 Starting PR validation..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building project..."
npm run build

echo "🧪 Running unit tests..."
npm run test:unit

echo "✨ Checking code formatting..."
npm run format:check || {
    echo "⚠️  Code formatting issues found. Run 'npm run format' to fix."
    exit 1
}

echo "🔍 Running linter..."
npm run lint || {
    echo "⚠️  Linting issues found. Run 'npm run lint:fix' to fix."
    exit 1
}

echo "📊 Running tests with coverage..."
npm run test:coverage

# Check if integration tests should run
if [ -n "$GITLAB_TOKEN" ] && [ -n "$TEST_PROJECT_ID" ]; then
    echo "🌐 Running integration tests..."
    npm run test:integration
else
    echo "⚠️  Skipping integration tests (no credentials provided)"
fi

echo "🐳 Testing Docker build..."
if command -v docker &> /dev/null; then
    docker build -t mcp-gitlab-test .
    echo "✅ Docker build successful"
else
    echo "⚠️  Docker not available, skipping Docker build test"
fi

echo "✅ All PR validation checks passed!"