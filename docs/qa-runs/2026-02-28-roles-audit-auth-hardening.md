# QA Run 2026-02-28: Roles audit + auth hardening

## Scope
- Role detail + permission assignment + audit filtering
- Web auth session behavior in mock mode
- Android refresh/logout auth flow
- tvOS token refresh and retry behavior
- Malaga staging seed integration

## Commands
- `cd apps/backend && ./vendor/bin/phpunit`
- `cd apps/web && npm run test -- --run && npm run build`
- `cd apps/android && ./gradlew test :app:assembleDebug`
- `xcodebuild -workspace apps/apple/EcoDeliveryRoutes.xcworkspace -scheme EcoDeliveryRoutesTV -destination 'generic/platform=tvOS Simulator' build`

## Result
- Backend: PASS (97 tests, 809 assertions)
- Web: PASS (7 test files, 11 tests) + production build PASS
- Android: PASS (`test` and `:app:assembleDebug`)
- tvOS: PASS (`EcoDeliveryRoutesTV` build)

## Notes
- `stripDebugDebugSymbols` informational message can appear in Android build logs; build remains successful.
- tvOS build may show AppIntents metadata warning if framework is not used; non-blocking for current scope.
