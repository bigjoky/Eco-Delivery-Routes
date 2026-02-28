# QA Run 2026-02-28: Partners module MVP

## Scope
- Backend: subcontractors/drivers/vehicles endpoints + vehicles migration
- Web: partners page + mock/api client integration
- Seeds: operations + Malaga staging vehicles

## Commands
- `cd apps/backend && ./vendor/bin/phpunit`
- `cd apps/web && npm run test -- --run && npm run build`
- `cd apps/android && ./gradlew test :app:assembleDebug`
- `xcodebuild -workspace apps/apple/EcoDeliveryRoutes.xcworkspace -scheme EcoDeliveryRoutesMac -destination 'generic/platform=macOS' build`

## Result
- Backend: PASS (106 tests, 866 assertions)
- Web: PASS (8 test files, 12 tests) + build PASS
- Android: PASS
- macOS: PASS
