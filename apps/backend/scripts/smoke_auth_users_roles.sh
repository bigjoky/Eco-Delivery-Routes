#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8000/api/v1}"
EMAIL="${2:-admin@eco.local}"
PASSWORD="${3:-password123}"

login_response=$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"device_name\":\"smoke-script\"}")

token=$(printf '%s' "$login_response" | php -r '$d=json_decode(stream_get_contents(STDIN), true); echo $d["token"] ?? "";')
if [ -z "$token" ]; then
  echo "Login failed: $login_response"
  exit 1
fi

echo "Login OK"

users_response=$(curl -sS -H "Authorization: Bearer $token" "$BASE_URL/users")
printf '%s' "$users_response" | php -r '$d=json_decode(stream_get_contents(STDIN), true); if (!isset($d["data"])) { exit(1);} echo "Users OK\n";'

roles_response=$(curl -sS -H "Authorization: Bearer $token" "$BASE_URL/roles")
printf '%s' "$roles_response" | php -r '$d=json_decode(stream_get_contents(STDIN), true); if (!isset($d["data"])) { exit(1);} echo "Roles OK\n";'

echo "Smoke checks passed"
