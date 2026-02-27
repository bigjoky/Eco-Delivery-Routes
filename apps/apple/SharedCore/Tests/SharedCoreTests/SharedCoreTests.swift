import XCTest
@testable import SharedCore

final class SharedCoreTests: XCTestCase {
    func test_quality_snapshot_decodes_snake_case_payload() throws {
        let payload = """
        {
          "id": "q-100",
          "scope_type": "route",
          "scope_id": "route-1",
          "scope_label": "R-AGP-01",
          "period_start": "2026-02-01",
          "period_end": "2026-02-28",
          "service_quality_score": 95.3,
          "assigned_with_attempt": 100,
          "delivered_completed": 94,
          "pickups_completed": 2
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(QualitySnapshot.self, from: payload)

        XCTAssertEqual(decoded.scopeType, "route")
        XCTAssertEqual(decoded.scopeId, "route-1")
        XCTAssertEqual(decoded.serviceQualityScore, 95.3, accuracy: 0.001)
        XCTAssertEqual(decoded.deliveredCompleted + decoded.pickupsCompleted, 96)
    }

    func test_api_client_uses_mock_when_base_url_is_nil() async throws {
        let client = APIClient(baseURL: nil)
        let routeRows = try await client.qualitySnapshots(scopeType: "route")
        XCTAssertEqual(routeRows.count, 1)
        XCTAssertEqual(routeRows.first?.scopeType, "route")
    }
}
