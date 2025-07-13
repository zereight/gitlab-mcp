#!/bin/bash
apt update && apt install -y curl

URL="http://localhost:8081/users/sign_in"
KEYWORD="Username or primary email"
MAX_RETRIES=10
SLEEP_SECONDS=60

for ((i=1; i<=MAX_RETRIES; i++)); do
    echo "Try #$i: curl $URL"
    
    response=$(curl -s "$URL")

    if echo "$response" | grep -q "$KEYWORD"; then
        echo "✅ Keyword found: '$KEYWORD'"
        bash /etc/dump/restore-gitlab.sh
        exit 0
    else
        echo "❌ Keyword not found. Waiting $SLEEP_SECONDS seconds..."
        sleep $SLEEP_SECONDS
    fi
done

echo "⏰ Timeout: '$KEYWORD' not found in $MAX_RETRIES tries."
exit 1
