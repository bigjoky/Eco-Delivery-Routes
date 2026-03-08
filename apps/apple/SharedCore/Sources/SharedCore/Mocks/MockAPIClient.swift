import Foundation

public final class MockAPIClient {
    private var mockQualityThreshold = QualityThresholdConfig(
        threshold: 95,
        sourceType: "default",
        sourceId: nil,
        canManage: true
    )
    private var mockQualityThresholdAlertSettings = QualityThresholdAlertSettings(
        largeDeltaThreshold: 5,
        windowHours: 24,
        canManage: true,
        sourceType: "default"
    )

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
    private let mockUsers: [User] = [
        User(
            id: "u-1",
            name: "Admin Demo",
            email: "admin@eco.local",
            status: "active",
            lastLoginAt: "2026-02-28T08:30:00Z",
            roles: [UserRole(id: "r-1", code: "super_admin", name: "Super Admin")]
        ),
        User(
            id: "u-2",
            name: "Ops Demo",
            email: "ops@eco.local",
            status: "active",
            lastLoginAt: "2026-02-28T07:05:00Z",
            roles: [UserRole(id: "r-2", code: "operations_manager", name: "Operations Manager")]
        ),
        User(
            id: "u-3",
            name: "Driver Demo",
            email: "driver@eco.local",
            status: "suspended",
            lastLoginAt: "2026-02-20T17:10:00Z",
            roles: [UserRole(id: "r-3", code: "driver", name: "Driver")]
        ),
    ]

    public init() {}

    public func login(email: String, password: String) async throws -> AuthToken {
        _ = (email, password)
        return AuthToken(token: "mock-token")
    }

    public func me() async throws -> User {
        mockUsers.first ?? User(
            id: "u-1",
            name: "Admin Demo",
            email: "admin@eco.local",
            status: "active",
            roles: [UserRole(id: "r-1", code: "super_admin", name: "Super Admin")]
        )
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

    public func users(status: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<User> {
        let filtered = status == nil || status?.isEmpty == true
            ? mockUsers
            : mockUsers.filter { $0.status == status }
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

    public func createShipment(
        hubId: String,
        consigneeName: String,
        consigneeDocumentId: String,
        consigneePhone: String,
        senderName: String,
        senderDocumentId: String,
        senderPhone: String,
        scheduledAt: String?,
        serviceType: String
    ) async throws {
        _ = (
            hubId,
            consigneeName,
            consigneeDocumentId,
            consigneePhone,
            senderName,
            senderDocumentId,
            senderPhone,
            scheduledAt,
            serviceType
        )
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

    public func qualityThreshold() async throws -> QualityThresholdConfig {
        mockQualityThreshold
    }

    public func updateQualityThreshold(threshold: Double, scopeType: String?, scopeId: String?) async throws -> QualityThresholdConfig {
        let resolvedScopeType = scopeType ?? "user"
        mockQualityThreshold = QualityThresholdConfig(
            threshold: threshold,
            sourceType: resolvedScopeType,
            sourceId: scopeId,
            canManage: true
        )
        return mockQualityThreshold
    }

    public func qualityThresholdAlertSettings() async throws -> QualityThresholdAlertSettings {
        mockQualityThresholdAlertSettings
    }

    public func qualityThresholdHistory(dateFrom: String?, dateTo: String?) async throws -> [QualityThresholdHistoryEntry] {
        _ = (dateFrom, dateTo)
        return [
            QualityThresholdHistoryEntry(
                id: 301,
                event: "quality.threshold.updated",
                actorUserId: "u-1",
                actorName: "Admin Demo",
                createdAt: "2026-02-28T09:00:00Z",
                scopeType: "role",
                scopeId: "driver"
            ),
            QualityThresholdHistoryEntry(
                id: 302,
                event: "quality.threshold.alert.large_delta",
                actorUserId: "u-1",
                actorName: "Admin Demo",
                createdAt: "2026-02-28T10:45:00Z",
                scopeType: "role",
                scopeId: "driver"
            ),
        ]
    }

    public func qualityThresholdAlertTopScopes(dateFrom: String?, dateTo: String?, limit: Int?) async throws -> [QualityThresholdAlertTopScope] {
        _ = (dateFrom, dateTo)
        return Array([
            QualityThresholdAlertTopScope(scopeType: "role", scopeId: "driver", scopeLabel: "Driver", alertsCount: 3),
            QualityThresholdAlertTopScope(scopeType: "global", scopeId: nil, scopeLabel: "Global", alertsCount: 1),
        ].prefix(max(1, min(limit ?? 5, 100))))
    }

    public func dashboardOverview(
        period: String?,
        dateFrom: String?,
        dateTo: String?,
        hubId: String?,
        subcontractorId: String?
    ) async throws -> DashboardOverview {
        let now = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let to = dateTo ?? formatter.string(from: now)
        let from = dateFrom ?? formatter.string(from: Calendar.current.date(byAdding: .day, value: -6, to: now) ?? now)
        let resolvedPreset = period ?? ((dateFrom != nil || dateTo != nil) ? "custom" : "7d")

        return DashboardOverview(
            period: DashboardPeriod(from: from, to: to, preset: resolvedPreset),
            filters: DashboardFilters(hubId: hubId, subcontractorId: subcontractorId),
            totals: DashboardTotals(shipments: 124, routes: 18, incidentsOpen: 7, qualityThreshold: 95),
            shipmentsByStatus: DashboardShipmentsByStatus(created: 22, outForDelivery: 31, delivered: 65, incident: 6),
            routesByStatus: DashboardRoutesByStatus(planned: 6, inProgress: 8, completed: 4),
            quality: DashboardQuality(routeAvg: 94.7, driverAvg: 96.2, belowThresholdRoutes: 5),
            sla: DashboardSLA(onTrack: 4, atRisk: 2, breached: 1, resolved: 9),
            trends: DashboardTrends(
                shipments: [
                    DashboardShipmentTrend(date: from, total: 14, delivered: 10, incident: 2),
                    DashboardShipmentTrend(date: to, total: 18, delivered: 15, incident: 1),
                ],
                routes: [
                    DashboardRouteTrend(date: from, total: 4, completed: 2),
                    DashboardRouteTrend(date: to, total: 5, completed: 3),
                ],
                incidents: [
                    DashboardIncidentTrend(date: from, open: 3, resolved: 1),
                    DashboardIncidentTrend(date: to, open: 2, resolved: 2),
                ],
                quality: [
                    DashboardQualityTrend(date: from, routeAvg: 93.8),
                    DashboardQualityTrend(date: to, routeAvg: 95.1),
                ]
            ),
            alerts: [
                DashboardAlert(
                    id: "incidents-open",
                    severity: "high",
                    title: "Incidencias abiertas",
                    message: "Hay incidencias pendientes de resolución.",
                    href: "/incidents?resolved=open",
                    count: 7
                ),
                DashboardAlert(
                    id: "quality-below-threshold",
                    severity: "medium",
                    title: "Rutas bajo umbral",
                    message: "Revisar rutas por debajo del objetivo de calidad.",
                    href: "/quality?scopeType=route",
                    count: 5
                ),
            ]
        )
    }

    public func exportDashboardOverviewCsv(
        period: String?,
        dateFrom: String?,
        dateTo: String?,
        hubId: String?,
        subcontractorId: String?
    ) async throws {
        _ = (period, dateFrom, dateTo, hubId, subcontractorId)
    }

    public func exportDashboardOverviewPdf(
        period: String?,
        dateFrom: String?,
        dateTo: String?,
        hubId: String?,
        subcontractorId: String?
    ) async throws {
        _ = (period, dateFrom, dateTo, hubId, subcontractorId)
    }

    public func routeAssignmentPreview(
        subcontractorId: String?,
        driverId: String?,
        vehicleId: String?,
        routeId: String?,
        routeDate: String?
    ) async throws -> RouteAssignmentPreview {
        _ = (subcontractorId, driverId, vehicleId, routeId, routeDate)
        return RouteAssignmentPreview(
            valid: true,
            conflicts: [],
            warnings: [
                RouteAssignmentMessage(field: "driver_id", message: "Driver quality score is below 95%.", code: "LOW_DRIVER_QUALITY")
            ],
            recommendedSubcontractorId: subcontractorId
        )
    }

    public func routeAssignmentPublishPolicy() async throws -> RouteAssignmentPublishPolicy {
        RouteAssignmentPublishPolicy(
            enforceOnPublish: true,
            criticalWarningCodes: ["LOW_DRIVER_QUALITY", "LOW_SUBCONTRACTOR_QUALITY"],
            bypassRoleCodes: ["super_admin"]
        )
    }

    public func hubs(onlyActive: Bool, includeDeleted: Bool = false) async throws -> [HubSummary] {
        let rows = [
            HubSummary(id: "hub-1", code: "AGP-HUB-01", name: "Hub Malaga Centro", city: "Malaga", isActive: true, deletedAt: nil),
            HubSummary(id: "hub-2", code: "SEV-HUB-01", name: "Hub Sevilla Norte", city: "Sevilla", isActive: true, deletedAt: nil),
        ]
        let filteredByDelete = includeDeleted ? rows : rows.filter { $0.deletedAt == nil }
        return onlyActive ? filteredByDelete.filter { $0.isActive } : filteredByDelete
    }

    public func depots(hubId: String?, includeDeleted: Bool = false) async throws -> [DepotSummary] {
        let rows = [
            DepotSummary(
                id: "dep-1",
                hubId: "hub-1",
                code: "DPT-AGP-0001",
                name: "Depot Malaga Centro",
                addressLine: "Av. Andalucia 10",
                city: "Malaga",
                isActive: true,
                deletedAt: nil
            ),
        ]
        let filteredByDelete = includeDeleted ? rows : rows.filter { $0.deletedAt == nil }
        guard let hubId, !hubId.isEmpty else { return filteredByDelete }
        return filteredByDelete.filter { $0.hubId == hubId }
    }

    public func points(hubId: String?, depotId: String?, includeDeleted: Bool = false) async throws -> [PointSummary] {
        let rows = [
            PointSummary(
                id: "pt-1",
                hubId: "hub-1",
                depotId: "dep-1",
                code: "PNT-AGP-0001",
                name: "Punto Centro 1",
                addressLine: "Calle Larios 5",
                city: "Malaga",
                isActive: true,
                deletedAt: nil
            ),
        ]
        let filteredByDelete = includeDeleted ? rows : rows.filter { $0.deletedAt == nil }
        return filteredByDelete.filter { row in
            let hubMatch = hubId == nil || hubId?.isEmpty == true || row.hubId == hubId
            let depotMatch = depotId == nil || depotId?.isEmpty == true || row.depotId == depotId
            return hubMatch && depotMatch
        }
    }

    public func createHub(name: String, city: String) async throws -> HubSummary {
        HubSummary(id: "hub-new", code: "HUB-NEW", name: name, city: city, isActive: true, deletedAt: nil)
    }

    public func updateHub(id: String, name: String, city: String?) async throws -> HubSummary {
        HubSummary(id: id, code: "AGP-HUB-01", name: name, city: city, isActive: true, deletedAt: nil)
    }

    public func createDepot(hubId: String, name: String, city: String?) async throws -> DepotSummary {
        DepotSummary(id: "dep-new", hubId: hubId, code: "DPT-NEW", name: name, addressLine: nil, city: city, isActive: true, deletedAt: nil)
    }

    public func updateDepot(id: String, name: String, city: String?) async throws -> DepotSummary {
        DepotSummary(id: id, hubId: "hub-1", code: "DPT-AGP-0001", name: name, addressLine: nil, city: city, isActive: true, deletedAt: nil)
    }

    public func createPoint(hubId: String, depotId: String?, name: String, city: String?) async throws -> PointSummary {
        PointSummary(id: "pt-new", hubId: hubId, depotId: depotId, code: "PNT-NEW", name: name, addressLine: nil, city: city, isActive: true, deletedAt: nil)
    }

    public func updatePoint(id: String, name: String, city: String?) async throws -> PointSummary {
        PointSummary(id: id, hubId: "hub-1", depotId: "dep-1", code: "PNT-AGP-0001", name: name, addressLine: nil, city: city, isActive: true, deletedAt: nil)
    }

    public func archiveHub(id: String) async throws {
        _ = id
    }

    public func archiveDepot(id: String) async throws {
        _ = id
    }

    public func archivePoint(id: String) async throws {
        _ = id
    }

    public func restoreHub(id: String) async throws -> HubSummary {
        _ = id
        return HubSummary(id: "hub-1", code: "AGP-HUB-01", name: "Hub Malaga Centro", city: "Malaga", isActive: true, deletedAt: nil)
    }

    public func restoreDepot(id: String) async throws -> DepotSummary {
        _ = id
        return DepotSummary(id: "dep-1", hubId: "hub-1", code: "DPT-AGP-0001", name: "Depot Malaga Centro", addressLine: "Av. Andalucia 10", city: "Malaga", isActive: true, deletedAt: nil)
    }

    public func restorePoint(id: String) async throws -> PointSummary {
        _ = id
        return PointSummary(id: "pt-1", hubId: "hub-1", depotId: "dep-1", code: "PNT-AGP-0001", name: "Punto Centro 1", addressLine: "Calle Larios 5", city: "Malaga", isActive: true, deletedAt: nil)
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

    public func qualitySubcontractorBreakdown(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws -> QualitySubcontractorBreakdown {
        _ = (periodStart, periodEnd)
        return QualitySubcontractorBreakdown(
            scopeType: "subcontractor",
            scopeId: subcontractorId,
            scopeLabel: "Rapid Last Mile",
            subcontractorId: subcontractorId,
            subcontractorCode: "Rapid Last Mile",
            granularity: granularity ?? "month",
            latestSnapshotId: "q-sub-1",
            latestPeriodStart: "2026-02-01",
            latestPeriodEnd: "2026-02-28",
            snapshotsCount: 1,
            serviceQualityScore: 95.42,
            periods: [
                .init(
                    periodKey: "2026-02",
                    periodStart: "2026-02-01",
                    periodEnd: "2026-02-28",
                    serviceQualityScore: 95.42,
                    components: .init(
                        assignedWithAttempt: 260,
                        deliveredCompleted: 240,
                        pickupsCompleted: 8,
                        failedCount: 7,
                        absentCount: 3,
                        retryCount: 2,
                        completedTotal: 248,
                        completionRatio: 95.42
                    )
                )
            ],
            components: .init(
                assignedWithAttempt: 260,
                deliveredCompleted: 240,
                pickupsCompleted: 8,
                failedCount: 7,
                absentCount: 3,
                retryCount: 2,
                completedTotal: 248,
                completionRatio: 95.42
            )
        )
    }

    public func exportQualitySubcontractorBreakdownCsv(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        _ = (subcontractorId, periodStart, periodEnd, granularity)
    }

    public func exportQualitySubcontractorBreakdownPdf(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        _ = (subcontractorId, periodStart, periodEnd, granularity)
    }

    public func downloadShipmentsTemplate() async throws -> Data {
        let content = "hub_code,reference,consignee_name,address_line,scheduled_at,service_type\nAGP-HUB-01,SHP-AGP-0009,Cliente Demo,Calle Larios 12,2026-03-05T08:30:00Z,delivery\n"
        return Data(content.utf8)
    }

    public func importShipmentsCsv(fileUrl: URL, dryRun: Bool) async throws -> ShipmentsImportResult {
        _ = fileUrl
        return ShipmentsImportResult(
            dryRun: dryRun,
            createdCount: dryRun ? 0 : 2,
            skippedCount: 1,
            errorCount: 1,
            rows: [
                ShipmentsImportResult.Row(id: UUID().uuidString, row: 2, reference: "SHP-AGP-0011", status: "ok", errors: nil),
                ShipmentsImportResult.Row(id: UUID().uuidString, row: 3, reference: "SHP-AGP-0012", status: "ok", errors: nil),
                ShipmentsImportResult.Row(id: UUID().uuidString, row: 4, reference: "SHP-AGP-0001", status: "error", errors: ["reference ya existe"]),
            ],
            warnings: [],
            unknownColumns: []
        )
    }
}
