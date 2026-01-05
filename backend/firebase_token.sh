# firebase_token.sh
# Usage:
#   source ./firebase_token.sh "FIREBASE_API_KEY" "EMAIL" "PASSWORD"
#   curl ... -H "Authorization: Bearer $(idtoken)"

FIREBASE_API_KEY="${1:-$FIREBASE_API_KEY}"
EMAIL="${2:-$EMAIL}"
PASS="${3:-$PASS}"

STORE="${HOME}/.firebase-tokens"
mkdir -p "$STORE"
LOGIN_JSON="$STORE/login.json"
REFRESH_JSON="$STORE/refresh.json"

fail() {
  echo "ERR: $*" >&2
  return 1
}

login_once() {
  if [ ! -s "$LOGIN_JSON" ]; then
    curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"returnSecureToken\":true}" \
      > "$LOGIN_JSON"
  fi

  jq -e '.refreshToken' "$LOGIN_JSON" >/dev/null 2>&1 || {
    cat "$LOGIN_JSON" >&2
    fail "login failed (no refreshToken)"
  }
}

refresh_now() {
  local REFRESH
  REFRESH=$(jq -r '.refreshToken' "$LOGIN_JSON")
  [ -z "$REFRESH" ] && fail "no refreshToken"

  curl -s "https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEYFIREBASE_FIREBASE_API_KEY}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=refresh_token" \
    --data-urlencode "refresh_token=${REFRESH}" \
    > "$REFRESH_JSON"

  jq -e '.id_token' "$REFRESH_JSON" >/dev/null 2>&1 || {
    cat "$REFRESH_JSON" >&2
    fail "refresh failed (no id_token)"
  }
}

idtoken() {
  login_once || return 1
  refresh_now || return 1
  jq -r '.id_token' "$REFRESH_JSON"
}
