#!/bin/bash
source .env.test

curl -X POST \
  -H "Authorization: Bearer $GITLAB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { __type(name: \"Group\") { fields { name args { name type { name } } } } }"
  }' \
  "$GITLAB_API_URL/graphql" | jq '.data.__type.fields[] | select(.name == "workItems")'
