#!/bin/bash

# Test script for /prs Slack command
# Usage: ./test-prs.sh [text]
# Example: ./test-prs.sh help
# Example: ./test-prs.sh frontend
# Example: ./test-prs.sh all

SIGNING_SECRET="5b38bf4a9b87c20d14bbea2e05303450"
TEXT="${1:-help}"
TIMESTAMP=$(date +%s)

# URL encode the text parameter
TEXT_ENCODED=$(node -e "console.log(encodeURIComponent('$TEXT'))")

BODY="token=test_token&team_id=T12345&team_domain=test&channel_id=C12345&channel_name=general&user_id=U12345&user_name=testuser&command=/prs&text=$TEXT_ENCODED&response_url=http://localhost:3000/test&trigger_id=1234.5678"

# Generate signature
SIG_BASESTRING="v0:$TIMESTAMP:$BODY"
SIGNATURE="v0=$(echo -n "$SIG_BASESTRING" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | cut -d' ' -f2)"

echo "Testing /prs command with text: '$TEXT'"
echo "----------------------------------------"

curl -v -X POST http://localhost:3000/api/slack/events \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Slack-Request-Timestamp: $TIMESTAMP" \
  -H "X-Slack-Signature: $SIGNATURE" \
  -d "$BODY"

echo -e "\n----------------------------------------"
