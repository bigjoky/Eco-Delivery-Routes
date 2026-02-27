#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -n "${GRADLE_USER_HOME:-}" ]]; then
  export GRADLE_USER_HOME
elif [[ -d "$HOME/.gradle/wrapper/dists" ]]; then
  export GRADLE_USER_HOME="$HOME/.gradle"
else
  export GRADLE_USER_HOME="$ROOT_DIR/.gradle-user-home"
fi

run_step() {
  echo
  echo "==> $1"
  shift
  "$@"
}

run_step "Backend: phpunit contracts" bash -lc "cd \"$ROOT_DIR/apps/backend\" && ./vendor/bin/phpunit --filter 'DriverRouteHttpTest|DriverOpsFlowHttpTest|PaginationHttpTest'"
run_step "Web: vitest" bash -lc "cd \"$ROOT_DIR/apps/web\" && npm test -- --run"
run_step "Android: unit tests + debug assemble" bash -lc "cd \"$ROOT_DIR/apps/android\" && ./gradlew :app:testDebugUnitTest :app:assembleDebug"
run_step "Apple SharedCore: swift test" bash -lc "cd \"$ROOT_DIR/apps/apple/SharedCore\" && swift test"

echo
echo "All release checks for envios/rutas passed."
