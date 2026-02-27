import Foundation

public final class MockAPIClient {
    private var mockAdvances: [AdvanceSummary] = [
        AdvanceSummary(
            id: "adv-1",
            subcontractorId: "sub-1",
            subcontractorName: "Rapid Last Mile",
            amountCents: 125_000,
            currency: "EUR",
            status: "requested",
            reason: "Combustible y peajes",
            requestDate: "2026-02-20",
            approvedAt: nil
        ),
        AdvanceSummary(
            id: "adv-2",
            subcontractorId: "sub-2",
            subcontractorName: "ThermoParcel",
            amountCents: 98_500,
            currency: "EUR",
            status: "approved",
            reason: "Capacitacion operativa",
            requestDate: "2026-02-14",
            approvedAt: "2026-02-15T10:00:00Z"
        ),
    ]

    public init() {}

    public func login(email: String, password: String) async throws -> AuthToken {
        _ = (email, password)
        return AuthToken(token: "mock-token")
    }

    public func myRouteStops() async throws -> [DriverStop] {
        try await myRoute(routeDate: nil, status: nil).stops
    }

    public func myRoute(routeDate: String?, status: String?) async throws -> DriverRouteMePayload {
        let route = DriverRouteIdentity(
            id: "r-1",
            code: "R-AGP-20260227",
            routeDate: "2026-02-27",
            status: "in_progress"
        )

        if let routeDate, !routeDate.isEmpty, routeDate != route.routeDate {
            return DriverRouteMePayload(driver: nil, route: nil, stops: [])
        }
        if let status, !status.isEmpty, status != route.status {
            return DriverRouteMePayload(driver: nil, route: nil, stops: [])
        }

        return DriverRouteMePayload(
            driver: DriverIdentity(id: "drv-1", code: "DRV-AGP-001", name: "Driver Demo"),
            route: route,
            stops: [
            DriverStop(
                id: "st-1",
                sequence: 1,
                stopType: "DELIVERY",
                entityType: "shipment",
                entityId: "00000000-0000-0000-0000-000000000101",
                reference: "SHP-AGP-0001",
                status: "in_progress"
            ),
            DriverStop(
                id: "st-2",
                sequence: 2,
                stopType: "PICKUP",
                entityType: "pickup",
                entityId: "00000000-0000-0000-0000-000000000201",
                reference: "PCK-AGP-0001",
                status: "planned"
            )
        ])
    }

    public func advances(status: String?, period: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<AdvanceSummary> {
        var filtered = mockAdvances
        if let status, !status.isEmpty {
            filtered = filtered.filter { $0.status == status }
        }
        if let period, !period.isEmpty {
            filtered = filtered.filter { $0.requestDate.hasPrefix(period) }
        }

        let boundedPage = max(page, 1)
        let boundedPerPage = max(perPage, 1)
        let start = (boundedPage - 1) * boundedPerPage
        let end = min(start + boundedPerPage, filtered.count)
        let pageData = start < filtered.count ? Array(filtered[start..<end]) : []
        let lastPage = Int(ceil(Double(filtered.count) / Double(boundedPerPage)))

        return PaginatedResponse(
            data: pageData,
            meta: PaginationMeta(
                page: boundedPage,
                perPage: boundedPerPage,
                total: filtered.count,
                lastPage: max(lastPage, 1)
            )
        )
    }

    public func approveAdvance(id: String) async throws -> AdvanceSummary {
        guard let index = mockAdvances.firstIndex(where: { $0.id == id }) else {
            throw NSError(domain: "mock", code: 404)
        }
        let current = mockAdvances[index]
        let updated = AdvanceSummary(
            id: current.id,
            subcontractorId: current.subcontractorId,
            subcontractorName: current.subcontractorName,
            amountCents: current.amountCents,
            currency: current.currency,
            status: "approved",
            reason: current.reason,
            requestDate: current.requestDate,
            approvedAt: ISO8601DateFormatter().string(from: Date())
        )
        mockAdvances[index] = updated
        return updated
    }

    public func tariffs(serviceType: String?) async throws -> [TariffSummary] {
        let rows = [
            TariffSummary(
                id: "tar-1",
                serviceType: "delivery",
                amountCents: 850,
                currency: "EUR",
                validFrom: "2026-02-01",
                validTo: nil,
                hubId: nil,
                subcontractorId: "sub-1"
            ),
            TariffSummary(
                id: "tar-2",
                serviceType: "pickup_return",
                amountCents: 540,
                currency: "EUR",
                validFrom: "2026-02-01",
                validTo: nil,
                hubId: nil,
                subcontractorId: "sub-2"
            ),
        ]
        guard let serviceType, !serviceType.isEmpty else { return rows }
        return rows.filter { $0.serviceType == serviceType }
    }

    public func settlements(status: String?, period: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<SettlementSummary> {
        var rows = [
            SettlementSummary(
                id: "set-1",
                subcontractorId: "sub-1",
                subcontractorName: "Rapid Last Mile",
                periodStart: "2026-02-01",
                periodEnd: "2026-02-28",
                status: "draft",
                grossAmountCents: 450_000,
                advancesAmountCents: 125_000,
                adjustmentsAmountCents: 0,
                netAmountCents: 325_000,
                currency: "EUR"
            ),
            SettlementSummary(
                id: "set-2",
                subcontractorId: "sub-2",
                subcontractorName: "ThermoParcel",
                periodStart: "2026-02-01",
                periodEnd: "2026-02-28",
                status: "approved",
                grossAmountCents: 390_000,
                advancesAmountCents: 98_500,
                adjustmentsAmountCents: 15_000,
                netAmountCents: 306_500,
                currency: "EUR"
            ),
        ]
        if let status, !status.isEmpty {
            rows = rows.filter { $0.status == status }
        }
        if let period, !period.isEmpty {
            rows = rows.filter { $0.periodStart.hasPrefix(period) }
        }

        let boundedPage = max(page, 1)
        let boundedPerPage = max(perPage, 1)
        let start = (boundedPage - 1) * boundedPerPage
        let end = min(start + boundedPerPage, rows.count)
        let pageData = start < rows.count ? Array(rows[start..<end]) : []
        let lastPage = Int(ceil(Double(rows.count) / Double(boundedPerPage)))

        return PaginatedResponse(
            data: pageData,
            meta: PaginationMeta(
                page: boundedPage,
                perPage: boundedPerPage,
                total: rows.count,
                lastPage: max(lastPage, 1)
            )
        )
    }

    public func registerScan(trackableType: String, trackableId: String, scanCode: String) async throws {
        _ = (trackableType, trackableId, scanCode)
    }

    public func registerPod(evidenceType: String, evidenceId: String, signatureName: String) async throws {
        _ = (evidenceType, evidenceId, signatureName)
    }

    public func createPickup(reference: String, pickupType: String, hubId: String) async throws {
        _ = (reference, pickupType, hubId)
    }

    public func registerIncident(
        incidentableType: String,
        incidentableId: String,
        catalogCode: String,
        category: String,
        notes: String
    ) async throws {
        _ = (incidentableType, incidentableId, catalogCode, category, notes)
    }

    public func qualitySnapshots(scopeType: String?) async throws -> [QualitySnapshot] {
        let rows = [
            QualitySnapshot(
                id: "q-1",
                scopeType: "driver",
                scopeId: "drv-1",
                scopeLabel: "DRV-AGP-001",
                periodStart: "2026-02-01",
                periodEnd: "2026-02-28",
                serviceQualityScore: 96.4,
                assignedWithAttempt: 450,
                deliveredCompleted: 430,
                pickupsCompleted: 3
            ),
            QualitySnapshot(
                id: "q-2",
                scopeType: "route",
                scopeId: "r-1",
                scopeLabel: "R-AGP-20260227",
                periodStart: "2026-02-01",
                periodEnd: "2026-02-28",
                serviceQualityScore: 94.5,
                assignedWithAttempt: 120,
                deliveredCompleted: 110,
                pickupsCompleted: 3
            ),
        ]
        guard let scopeType, !scopeType.isEmpty else { return rows }
        return rows.filter { $0.scopeType == scopeType }
    }

    public func qualityRouteBreakdown(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws -> QualityRouteBreakdown {
        _ = (periodStart, periodEnd)
        return QualityRouteBreakdown(
            scopeType: "route",
            scopeId: routeId,
            scopeLabel: "R-AGP-20260227",
            routeId: routeId,
            routeCode: "R-AGP-20260227",
            hubId: "00000000-0000-0000-0000-000000000001",
            subcontractorId: "sub-1",
            granularity: granularity ?? "month",
            latestSnapshotId: "q-2",
            latestPeriodStart: "2026-02-01",
            latestPeriodEnd: "2026-02-28",
            snapshotsCount: 1,
            serviceQualityScore: 94.5,
            periods: [
                .init(
                    periodKey: "2026-02",
                    periodStart: "2026-02-01",
                    periodEnd: "2026-02-28",
                    serviceQualityScore: 94.17,
                    components: .init(
                        assignedWithAttempt: 120,
                        deliveredCompleted: 110,
                        pickupsCompleted: 3,
                        failedCount: 4,
                        absentCount: 2,
                        retryCount: 1,
                        completedTotal: 113,
                        completionRatio: 94.17
                    )
                ),
            ],
            components: .init(
                assignedWithAttempt: 120,
                deliveredCompleted: 110,
                pickupsCompleted: 3,
                failedCount: 4,
                absentCount: 2,
                retryCount: 1,
                completedTotal: 113,
                completionRatio: 94.17
            )
        )
    }

    public func exportQualityRouteBreakdownCsv(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        _ = (routeId, periodStart, periodEnd, granularity)
    }

    public func exportQualityRouteBreakdownPdf(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        _ = (routeId, periodStart, periodEnd, granularity)
    }
}
