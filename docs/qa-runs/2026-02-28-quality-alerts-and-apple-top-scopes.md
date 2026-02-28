# QA Run 2026-02-28 - Quality Alerts + Apple Top Scopes

## Scope
- Quality threshold alerts:
  - configurable delta/window
  - summary + top scopes endpoints
  - web alert center (filters + pagination + URL state)
- Apple dashboards:
  - macOS quality: top scopes block
  - tvOS monitor: top scopes block

## Automated checks executed
- Backend:
  - `./vendor/bin/phpunit tests/Feature/Api/V1/QualityThresholdAlertSummaryHttpTest.php tests/Feature/Api/V1/QualityThresholdAlertTopScopesHttpTest.php tests/Feature/Api/V1/QualityThresholdAlertSettingsHttpTest.php`
  - Result: OK
- Web:
  - `npm run build`
  - Result: OK

## Manual QA status
- Staging environment manual QA: Pending.
- Required manual checks:
  - Verify `/quality` URL params persistence: `alert_scope_type`, `alert_scope_id`, `alert_page`.
  - Verify web table pagination for delta alerts with real dataset > 10 rows.
  - Verify macOS and tvOS dashboards show top scopes from API when `API_BASE_URL` + token are configured.
  - Verify fallback behavior on API failure (no crash, graceful empty top scopes).
