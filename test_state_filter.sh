#!/bin/bash
source .env.test

echo "Testing Group workItems with state filter..."
curl -s -X POST \
  -H "Authorization: Bearer $GITLAB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { group(fullPath: \"pt\") { workItems(types: [EPIC], state: OPEN, first: 10) { nodes { id title state } pageInfo { hasNextPage endCursor } } } }"
  }' \
  "$GITLAB_API_URL/graphql" | jq '.'
