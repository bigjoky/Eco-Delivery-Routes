# QA Run 2026-02-28: User lifecycle + macOS users API

## Scope
- User lifecycle endpoints: suspend/reactivate/reset-password
- Role permissions validation/not-found coverage
- Web user management actions
- SharedCore/macOS users list against API contract

## Commands
- `cd apps/backend && ./vendor/bin/phpunit`
- `cd apps/web && npm run test -- --run && npm run build`
- `cd apps/android && ./gradlew test :app:assembleDebug`
- `xcodebuild -workspace apps/apple/EcoDeliveryRoutes.xcworkspace -scheme EcoDeliveryRoutesMac -destination 'generic/platform=macOS' build`
- `xcodebuild -workspace apps/apple/EcoDeliveryRoutes.xcworkspace -scheme EcoDeliveryRoutesTV -destination 'generic/platform=tvOS Simulator' build`

## Result
- Backend: PASS (104 tests, 846 assertions)
- Web: PASS (7 test files, 11 tests) + build PASS
- Android: PASS (`test`, `:app:assembleDebug`)
- macOS: PASS (`EcoDeliveryRoutesMac`)
- tvOS: PASS (`EcoDeliveryRoutesTV`)

## Notes
- A transient tvOS build-db lock occurred only when running parallel xcodebuild commands; sequential rerun passed.
