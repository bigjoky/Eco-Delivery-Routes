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

    func test_driver_stop_decodes_entity_contract() throws {
        let payload = """
        {
          "id": "st-1",
          "sequence": 1,
          "stopType": "DELIVERY",
          "entityType": "shipment",
          "entityId": "00000000-0000-0000-0000-000000000101",
          "reference": "SHP-AGP-0001",
          "status": "planned"
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(DriverStop.self, from: payload)
        XCTAssertEqual(decoded.entityType, "shipment")
        XCTAssertEqual(decoded.entityId, "00000000-0000-0000-0000-000000000101")
    }

    func test_mock_driver_route_supports_route_date_filter() async throws {
        let client = APIClient(baseURL: nil)
        let empty = try await client.myRoute(routeDate: "2099-01-01", status: nil)
        XCTAssertTrue(empty.stops.isEmpty)
        XCTAssertNil(empty.route)
    }

    func test_mock_driver_route_supports_status_filter() async throws {
        let client = APIClient(baseURL: nil)
        let empty = try await client.myRoute(routeDate: nil, status: "completed")
        XCTAssertTrue(empty.stops.isEmpty)
        XCTAssertNil(empty.route)
    }

    func test_mock_driver_route_operational_calls_accept_entity_contract() async throws {
        let client = APIClient(baseURL: nil)
        let payload = try await client.myRoute(routeDate: nil, status: nil)
        guard let target = payload.stops.first else {
            XCTFail("Expected at least one stop in mock payload")
            return
        }

        try await client.registerScan(trackableType: target.entityType, trackableId: target.entityId, scanCode: "SCAN-001")
        try await client.registerPod(evidenceType: target.entityType, evidenceId: target.entityId, signatureName: "Driver Demo")
        try await client.registerIncident(
            incidentableType: target.entityType,
            incidentableId: target.entityId,
            catalogCode: "ABSENT_HOME",
            category: "absent",
            notes: "Driver could not reach customer"
        )
    }
}
