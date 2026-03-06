import Foundation
import SwiftUI

struct ContentView: View {
    let monitorService: TVMonitorService

    @State private var users: [TVUser] = []
    @State private var roles: [TVRole] = []
    @State private var routeQuality: [TVRouteQuality] = []
    @State private var driverQuality: [TVDriverQuality] = []
    @State private var subcontractorQuality: [TVSubcontractorQuality] = []
    @State private var routeBreakdown: TVRouteBreakdown?
    @State private var driverBreakdown: TVDriverBreakdown?
    @State private var subcontractorBreakdown: TVSubcontractorBreakdown?
    @State private var qualityThreshold: Double = 95
    @State private var thresholdDeltaAlertCount: Int = 0
    @State private var thresholdDeltaTopScopes: [TVThresholdAlertTopScope] = []
    @State private var thresholdDeltaWindowHours: Int = 24
    @State private var thresholdDeltaTrigger: Double = 5
    @State private var hubsCount: Int = 0
    @State private var depotsCount: Int = 0
    @State private var pointsCount: Int = 0
    @State private var archivedNodesCount: Int = 0
    @State private var lastRefreshText: String = "Sin refresco"
    @State private var statusText: String = "Conectando..."

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Eco Delivery Routes Monitor")
                        .font(.largeTitle)
                    Text(statusText)
                        .foregroundStyle(.secondary)
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
                    metricCard(title: "Usuarios", value: "\(users.count)")
                    metricCard(title: "Roles", value: "\(roles.count)")
                    metricCard(title: "Rutas KPI", value: "\(routeQuality.count)")
                    metricCard(title: "Conductores KPI", value: "\(driverQuality.count)")
                    metricCard(title: "Subcontratas KPI", value: "\(subcontractorQuality.count)")
                    metricCard(title: "Alertas delta", value: "\(thresholdDeltaAlertCount)")
                    metricCard(title: "Hubs/Depots/Puntos", value: "\(hubsCount)/\(depotsCount)/\(pointsCount)")
                    metricCard(title: "Nodos archivados", value: "\(archivedNodesCount)")
                }

                HStack(alignment: .top, spacing: 16) {
                    sectionCard(title: "Últimos usuarios") {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(users.prefix(5)) { user in
                                Text(user.name)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    sectionCard(title: "Roles disponibles") {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(roles.prefix(5)) { role in
                                Text(role.name)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                sectionCard(title: "Calidad por ruta") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(routeQuality.prefix(6)) { item in
                            Text("\(item.routeCode) · \(item.score, specifier: "%.2f")% · \(item.completed)/\(item.assigned)")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let routeBreakdown {
                    sectionCard(title: "Desglose ruta en riesgo") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(routeBreakdown.routeCode) · \(routeBreakdown.score, specifier: "%.2f")%")
                            Text("Asignados: \(routeBreakdown.assigned) · Completados: \(routeBreakdown.completed)")
                            Text("Fallidas: \(routeBreakdown.failed) · Ausencias: \(routeBreakdown.absent) · Reintentos: \(routeBreakdown.retry)")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                sectionCard(title: "Calidad por conductor") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(driverQuality.prefix(6)) { item in
                            Text("\(item.driverCode) · \(item.score, specifier: "%.2f")% · \(item.completed)/\(item.assigned)")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let driverBreakdown {
                    sectionCard(title: "Desglose conductor en riesgo") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(driverBreakdown.driverCode) · \(driverBreakdown.score, specifier: "%.2f")%")
                            Text("Asignados: \(driverBreakdown.assigned) · Completados: \(driverBreakdown.completed)")
                            Text("Fallidas: \(driverBreakdown.failed) · Ausencias: \(driverBreakdown.absent) · Reintentos: \(driverBreakdown.retry)")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                sectionCard(title: "Calidad por subcontrata") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(subcontractorQuality.prefix(6)) { item in
                            Text("\(item.subcontractorCode) · \(item.score, specifier: "%.2f")% · \(item.completed)/\(item.assigned)")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let subcontractorBreakdown {
                    sectionCard(title: "Desglose subcontrata en riesgo") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(subcontractorBreakdown.subcontractorCode) · \(subcontractorBreakdown.score, specifier: "%.2f")%")
                            Text("Asignados: \(subcontractorBreakdown.assigned) · Completados: \(subcontractorBreakdown.completed)")
                            Text("Fallidas: \(subcontractorBreakdown.failed) · Ausencias: \(subcontractorBreakdown.absent) · Reintentos: \(subcontractorBreakdown.retry)")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                sectionCard(title: "Alertas KPI < \(qualityThreshold.formatted(.number.precision(.fractionLength(2))))%") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(routeQuality.filter { $0.score < qualityThreshold }.prefix(3)) { item in
                            Text("Ruta \(item.routeCode) en alerta: \(item.score, specifier: "%.2f")%")
                                .foregroundStyle(.red)
                        }
                        ForEach(driverQuality.filter { $0.score < qualityThreshold }.prefix(3)) { item in
                            Text("Conductor \(item.driverCode) en alerta: \(item.score, specifier: "%.2f")%")
                                .foregroundStyle(.red)
                        }
                        ForEach(subcontractorQuality.filter { $0.score < qualityThreshold }.prefix(3)) { item in
                            Text("Subcontrata \(item.subcontractorCode) en alerta: \(item.score, specifier: "%.2f")%")
                                .foregroundStyle(.red)
                        }
                        Text("Cambios bruscos umbral: \(thresholdDeltaAlertCount) en \(thresholdDeltaWindowHours)h (trigger ±\(thresholdDeltaTrigger, specifier: "%.2f"))")
                            .font(.caption)
                            .foregroundStyle(thresholdDeltaAlertCount > 0 ? .red : .secondary)
                        if !thresholdDeltaTopScopes.isEmpty {
                            ForEach(thresholdDeltaTopScopes.prefix(5)) { scope in
                                Text("Top: \(scope.scopeType) · \(scope.scopeLabel ?? scope.scopeId ?? "-") (\(scope.alertsCount))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Text(lastRefreshText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
        .background(ecoBackground)
        .tint(.teal)
        .task {
            await startPolling()
        }
    }

    private var ecoBackground: some View {
        LinearGradient(
            colors: [
                Color(red: 0.04, green: 0.10, blue: 0.18),
                Color(red: 0.08, green: 0.16, blue: 0.28),
                Color(red: 0.18, green: 0.18, blue: 0.08)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    @ViewBuilder
    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
            Text(value)
                .font(.title2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .ecoPanelStyle(cornerRadius: 12)
    }

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .ecoPanelStyle(cornerRadius: 12)
    }

    private func startPolling() async {
        while !Task.isCancelled {
            await refresh()
            try? await Task.sleep(nanoseconds: 30_000_000_000)
        }
    }

    private func refresh() async {
        let payload = await monitorService.snapshot()
        users = payload.users
        roles = payload.roles
        routeQuality = payload.routeQuality
        driverQuality = payload.driverQuality
        subcontractorQuality = payload.subcontractorQuality
        routeBreakdown = payload.routeBreakdown
        driverBreakdown = payload.driverBreakdown
        subcontractorBreakdown = payload.subcontractorBreakdown
        qualityThreshold = payload.threshold
        thresholdDeltaAlertCount = payload.thresholdDeltaAlertCount
        thresholdDeltaTopScopes = payload.thresholdDeltaTopScopes
        thresholdDeltaWindowHours = payload.thresholdDeltaWindowHours
        thresholdDeltaTrigger = payload.thresholdDeltaTrigger
        hubsCount = payload.hubsCount
        depotsCount = payload.depotsCount
        pointsCount = payload.pointsCount
        archivedNodesCount = payload.archivedNodesCount
        statusText = payload.status

        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        formatter.dateStyle = .none
        lastRefreshText = "Última actualización: \(formatter.string(from: Date()))"
    }
}

#Preview {
    ContentView(monitorService: TVMonitorService())
}

struct TVUser: Identifiable {
    let id: String
    let name: String
}

struct TVRole: Identifiable {
    let id: String
    let name: String
}

struct TVSnapshot {
    let users: [TVUser]
    let roles: [TVRole]
    let routeQuality: [TVRouteQuality]
    let driverQuality: [TVDriverQuality]
    let subcontractorQuality: [TVSubcontractorQuality]
    let routeBreakdown: TVRouteBreakdown?
    let driverBreakdown: TVDriverBreakdown?
    let subcontractorBreakdown: TVSubcontractorBreakdown?
    let threshold: Double
    let thresholdDeltaAlertCount: Int
    let thresholdDeltaTopScopes: [TVThresholdAlertTopScope]
    let thresholdDeltaWindowHours: Int
    let thresholdDeltaTrigger: Double
    let hubsCount: Int
    let depotsCount: Int
    let pointsCount: Int
    let archivedNodesCount: Int
    let status: String
}

struct TVThresholdAlertTopScope: Identifiable {
    var id: String { "\(scopeType)|\(scopeId ?? "")" }
    let scopeType: String
    let scopeId: String?
    let scopeLabel: String?
    let alertsCount: Int
}

struct TVRouteQuality: Identifiable {
    let id: String
    let routeId: String
    let routeCode: String
    let score: Double
    let assigned: Int
    let completed: Int
}

struct TVDriverQuality: Identifiable {
    let id: String
    let driverId: String
    let driverCode: String
    let score: Double
    let assigned: Int
    let completed: Int
}

struct TVSubcontractorQuality: Identifiable {
    let id: String
    let subcontractorId: String
    let subcontractorCode: String
    let score: Double
    let assigned: Int
    let completed: Int
}

struct TVRouteBreakdown {
    let routeId: String
    let routeCode: String
    let score: Double
    let assigned: Int
    let completed: Int
    let failed: Int
    let absent: Int
    let retry: Int
}

struct TVDriverBreakdown {
    let driverId: String
    let driverCode: String
    let score: Double
    let assigned: Int
    let completed: Int
    let failed: Int
    let absent: Int
    let retry: Int
}

struct TVSubcontractorBreakdown {
    let subcontractorId: String
    let subcontractorCode: String
    let score: Double
    let assigned: Int
    let completed: Int
    let failed: Int
    let absent: Int
    let retry: Int
}

final class TVMonitorService {
    private var runtimeToken: String? = ProcessInfo.processInfo.environment["API_TOKEN"]

    func snapshot() async -> TVSnapshot {
        let apiSnapshot = await fetchQualityFromAPI()

        return TVSnapshot(
            users: [
                TVUser(id: "u-1", name: "Admin Demo"),
                TVUser(id: "u-2", name: "Ops Demo"),
                TVUser(id: "u-3", name: "Hub Manager")
            ],
            roles: [
                TVRole(id: "r-1", name: "Super Admin"),
                TVRole(id: "r-2", name: "Ops Manager"),
                TVRole(id: "r-3", name: "Viewer")
            ],
            routeQuality: apiSnapshot.routeQuality,
            driverQuality: apiSnapshot.driverQuality,
            subcontractorQuality: apiSnapshot.subcontractorQuality,
            routeBreakdown: apiSnapshot.routeBreakdown,
            driverBreakdown: apiSnapshot.driverBreakdown,
            subcontractorBreakdown: apiSnapshot.subcontractorBreakdown,
            threshold: apiSnapshot.threshold,
            thresholdDeltaAlertCount: apiSnapshot.thresholdDeltaAlertCount,
            thresholdDeltaTopScopes: apiSnapshot.thresholdDeltaTopScopes,
            thresholdDeltaWindowHours: apiSnapshot.thresholdDeltaWindowHours,
            thresholdDeltaTrigger: apiSnapshot.thresholdDeltaTrigger,
            hubsCount: apiSnapshot.hubsCount,
            depotsCount: apiSnapshot.depotsCount,
            pointsCount: apiSnapshot.pointsCount,
            archivedNodesCount: apiSnapshot.archivedNodesCount,
            status: apiSnapshot.status
        )
    }

    private func fetchQualityFromAPI() async -> (
        routeQuality: [TVRouteQuality],
        driverQuality: [TVDriverQuality],
        subcontractorQuality: [TVSubcontractorQuality],
        routeBreakdown: TVRouteBreakdown?,
        driverBreakdown: TVDriverBreakdown?,
        subcontractorBreakdown: TVSubcontractorBreakdown?,
        threshold: Double,
        thresholdDeltaAlertCount: Int,
        thresholdDeltaTopScopes: [TVThresholdAlertTopScope],
        thresholdDeltaWindowHours: Int,
        thresholdDeltaTrigger: Double,
        hubsCount: Int,
        depotsCount: Int,
        pointsCount: Int,
        archivedNodesCount: Int,
        status: String
    ) {
        let fallbackThreshold = Double(ProcessInfo.processInfo.environment["QUALITY_THRESHOLD"] ?? "") ?? 95
        guard
            let rawBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"],
            !rawBaseURL.isEmpty
        else {
            return (
                mockRouteQuality(),
                mockDriverQuality(),
                mockSubcontractorQuality(),
                mockRouteBreakdown(),
                mockDriverBreakdown(),
                mockSubcontractorBreakdown(),
                fallbackThreshold,
                0,
                [],
                24,
                5,
                2,
                4,
                8,
                1,
                "Monitor sin API real (fallback mock)"
            )
        }

        let normalizedBaseURL = rawBaseURL.hasSuffix("/v1") ? rawBaseURL : "\(rawBaseURL)/v1"
        guard
            let routeURL = URL(string: "\(normalizedBaseURL)/kpis/quality?scope_type=route"),
            let driverURL = URL(string: "\(normalizedBaseURL)/kpis/quality?scope_type=driver"),
            let subcontractorURL = URL(string: "\(normalizedBaseURL)/kpis/quality?scope_type=subcontractor")
        else {
            return (
                mockRouteQuality(),
                mockDriverQuality(),
                mockSubcontractorQuality(),
                mockRouteBreakdown(),
                mockDriverBreakdown(),
                mockSubcontractorBreakdown(),
                fallbackThreshold,
                0,
                [],
                24,
                5,
                2,
                4,
                8,
                1,
                "Monitor sin API real (URL invalida, fallback mock)"
            )
        }

        var token = await resolveAuthToken(normalizedBaseURL: normalizedBaseURL, explicitToken: nil)

        do {
            guard
                let routeResult = try await authorizedGet(url: routeURL, normalizedBaseURL: normalizedBaseURL, token: token),
                let driverResult = try await authorizedGet(url: driverURL, normalizedBaseURL: normalizedBaseURL, token: token),
                let subcontractorResult = try await authorizedGet(url: subcontractorURL, normalizedBaseURL: normalizedBaseURL, token: token)
            else {
                return (
                    mockRouteQuality(),
                    mockDriverQuality(),
                    mockSubcontractorQuality(),
                    mockRouteBreakdown(),
                    mockDriverBreakdown(),
                    mockSubcontractorBreakdown(),
                    fallbackThreshold,
                    0,
                    [],
                    24,
                    5,
                    2,
                    4,
                    8,
                    1,
                    "Monitor sin API real (error HTTP API calidad)"
                )
            }
            let routeData = routeResult.data
            let driverData = driverResult.data
            let subcontractorData = subcontractorResult.data
            token = subcontractorResult.token ?? driverResult.token ?? routeResult.token ?? token

            let routeDecoded = try JSONDecoder().decode(QualityEnvelope.self, from: routeData)
            let driverDecoded = try JSONDecoder().decode(QualityEnvelope.self, from: driverData)
            let subcontractorDecoded = try JSONDecoder().decode(QualityEnvelope.self, from: subcontractorData)
            let mappedRoutes = routeDecoded.data.map {
                TVRouteQuality(
                    id: $0.id,
                    routeId: $0.scopeId,
                    routeCode: $0.scopeLabel ?? $0.scopeId,
                    score: $0.serviceQualityScore,
                    assigned: $0.assignedWithAttempt,
                    completed: $0.deliveredCompleted + $0.pickupsCompleted
                )
            }
            let mappedDrivers = driverDecoded.data.map {
                TVDriverQuality(
                    id: $0.id,
                    driverId: $0.scopeId,
                    driverCode: $0.scopeLabel ?? $0.scopeId,
                    score: $0.serviceQualityScore,
                    assigned: $0.assignedWithAttempt,
                    completed: $0.deliveredCompleted + $0.pickupsCompleted
                )
            }
            let mappedSubcontractors = subcontractorDecoded.data.map {
                TVSubcontractorQuality(
                    id: $0.id,
                    subcontractorId: $0.scopeId,
                    subcontractorCode: $0.scopeLabel ?? $0.scopeId,
                    score: $0.serviceQualityScore,
                    assigned: $0.assignedWithAttempt,
                    completed: $0.deliveredCompleted + $0.pickupsCompleted
                )
            }

            if mappedRoutes.isEmpty && mappedDrivers.isEmpty && mappedSubcontractors.isEmpty {
                return (
                    mockRouteQuality(),
                    mockDriverQuality(),
                    mockSubcontractorQuality(),
                    mockRouteBreakdown(),
                    mockDriverBreakdown(),
                    mockSubcontractorBreakdown(),
                    fallbackThreshold,
                    0,
                    [],
                    24,
                    5,
                    2,
                    4,
                    8,
                    1,
                    "Monitor sin API real (API sin datos, fallback mock)"
                )
            }
            let worstRoute = mappedRoutes.min(by: { $0.score < $1.score })
            let routeBreakdown = await fetchRouteBreakdownFromAPI(
                normalizedBaseURL: normalizedBaseURL,
                token: token,
                routeId: worstRoute?.routeId
            )
            let worstDriver = mappedDrivers.min(by: { $0.score < $1.score })
            let driverBreakdown = await fetchDriverBreakdownFromAPI(
                normalizedBaseURL: normalizedBaseURL,
                token: token,
                driverId: worstDriver?.driverId
            )
            let worstSubcontractor = mappedSubcontractors.min(by: { $0.score < $1.score })
            let subcontractorBreakdown = await fetchSubcontractorBreakdownFromAPI(
                normalizedBaseURL: normalizedBaseURL,
                token: token,
                subcontractorId: worstSubcontractor?.subcontractorId
            )
            let threshold = await fetchThresholdFromAPI(
                normalizedBaseURL: normalizedBaseURL,
                token: token,
                fallbackThreshold: fallbackThreshold
            )
            let deltaAlert = await fetchThresholdDeltaAlertSummary(
                normalizedBaseURL: normalizedBaseURL,
                token: token
            )
            let topScopes = await fetchThresholdDeltaTopScopes(
                normalizedBaseURL: normalizedBaseURL,
                token: token
            )
            let networkSummary = await fetchNetworkSummaryFromAPI(
                normalizedBaseURL: normalizedBaseURL,
                token: token
            )
            return (
                mappedRoutes,
                mappedDrivers,
                mappedSubcontractors,
                routeBreakdown,
                driverBreakdown,
                subcontractorBreakdown,
                threshold,
                deltaAlert.count,
                topScopes,
                deltaAlert.windowHours,
                deltaAlert.deltaTrigger,
                networkSummary.hubsCount,
                networkSummary.depotsCount,
                networkSummary.pointsCount,
                networkSummary.archivedNodesCount,
                "Monitor activo (API real)"
            )
        } catch {
            return (
                mockRouteQuality(),
                mockDriverQuality(),
                mockSubcontractorQuality(),
                mockRouteBreakdown(),
                mockDriverBreakdown(),
                mockSubcontractorBreakdown(),
                fallbackThreshold,
                0,
                [],
                24,
                5,
                2,
                4,
                8,
                1,
                "Monitor sin API real (error conexion API)"
            )
        }
    }

    private func fetchNetworkSummaryFromAPI(normalizedBaseURL: String, token: String?) async -> (hubsCount: Int, depotsCount: Int, pointsCount: Int, archivedNodesCount: Int) {
        guard
            let hubsURL = URL(string: "\(normalizedBaseURL)/hubs?only_active=0&include_deleted=1"),
            let depotsURL = URL(string: "\(normalizedBaseURL)/depots?include_deleted=1"),
            let pointsURL = URL(string: "\(normalizedBaseURL)/points?include_deleted=1")
        else {
            return (2, 4, 8, 1)
        }

        do {
            guard
                let hubsResult = try await authorizedGet(url: hubsURL, normalizedBaseURL: normalizedBaseURL, token: token),
                let depotsResult = try await authorizedGet(url: depotsURL, normalizedBaseURL: normalizedBaseURL, token: hubsResult.token),
                let pointsResult = try await authorizedGet(url: pointsURL, normalizedBaseURL: normalizedBaseURL, token: depotsResult.token)
            else {
                return (2, 4, 8, 1)
            }

            let hubsSummary = decodeNetworkRowsSummary(from: hubsResult.data)
            let depotsSummary = decodeNetworkRowsSummary(from: depotsResult.data)
            let pointsSummary = decodeNetworkRowsSummary(from: pointsResult.data)
            return (
                hubsSummary.total,
                depotsSummary.total,
                pointsSummary.total,
                hubsSummary.archived + depotsSummary.archived + pointsSummary.archived
            )
        } catch {
            return (2, 4, 8, 1)
        }
    }

    private func decodeNetworkRowsSummary(from data: Data) -> (total: Int, archived: Int) {
        guard
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rows = payload["data"] as? [[String: Any]]
        else {
            return (0, 0)
        }

        let archived = rows.reduce(0) { partial, row in
            let deletedAt = row["deleted_at"] as? String
            return partial + ((deletedAt?.isEmpty == false) ? 1 : 0)
        }
        return (rows.count, archived)
    }

    private func resolveAuthToken(normalizedBaseURL: String, explicitToken: String?) async -> String? {
        if let explicitToken, !explicitToken.isEmpty {
            runtimeToken = explicitToken
            return explicitToken
        }
        if let runtimeToken, !runtimeToken.isEmpty {
            return runtimeToken
        }

        guard
            let email = ProcessInfo.processInfo.environment["API_EMAIL"],
            let password = ProcessInfo.processInfo.environment["API_PASSWORD"],
            !email.isEmpty,
            !password.isEmpty,
            let loginURL = URL(string: "\(normalizedBaseURL)/auth/login")
        else {
            return nil
        }

        var request = URLRequest(url: loginURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "email": email,
            "password": password,
            "device_name": "apple-tv-monitor",
        ])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            let decoded = try JSONDecoder().decode(LoginEnvelope.self, from: data)
            runtimeToken = decoded.token
            return decoded.token
        } catch {
            return nil
        }
    }

    private func authorizedGet(
        url: URL,
        normalizedBaseURL: String,
        token: String?
    ) async throws -> (data: Data, token: String?)? {
        let activeToken = await resolveAuthToken(normalizedBaseURL: normalizedBaseURL, explicitToken: token)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let activeToken, !activeToken.isEmpty {
            request.setValue("Bearer \(activeToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { return nil }
        if (200...299).contains(http.statusCode) {
            return (data, activeToken)
        }
        if http.statusCode == 401, let activeToken, let refreshed = await refreshAuthToken(normalizedBaseURL: normalizedBaseURL, currentToken: activeToken) {
            var retry = URLRequest(url: url)
            retry.httpMethod = "GET"
            retry.setValue("Bearer \(refreshed)", forHTTPHeaderField: "Authorization")
            let (retryData, retryResponse) = try await URLSession.shared.data(for: retry)
            guard let retryHttp = retryResponse as? HTTPURLResponse, (200...299).contains(retryHttp.statusCode) else {
                return nil
            }
            runtimeToken = refreshed
            return (retryData, refreshed)
        }
        return nil
    }

    private func refreshAuthToken(normalizedBaseURL: String, currentToken: String) async -> String? {
        guard let refreshURL = URL(string: "\(normalizedBaseURL)/auth/refresh") else {
            return nil
        }
        var request = URLRequest(url: refreshURL)
        request.httpMethod = "POST"
        request.setValue("Bearer \(currentToken)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                runtimeToken = nil
                return nil
            }
            let decoded = try JSONDecoder().decode(LoginEnvelope.self, from: data)
            runtimeToken = decoded.token
            return decoded.token
        } catch {
            runtimeToken = nil
            return nil
        }
    }

    private func fetchThresholdDeltaAlertSummary(normalizedBaseURL: String, token: String?) async -> (count: Int, windowHours: Int, deltaTrigger: Double) {
        let defaultWindow = 24
        let defaultTrigger = 5.0
        guard let settingsURL = URL(string: "\(normalizedBaseURL)/kpis/quality/threshold/alert-settings") else {
            return (0, defaultWindow, defaultTrigger)
        }

        do {
            guard let settingsResult = try await authorizedGet(url: settingsURL, normalizedBaseURL: normalizedBaseURL, token: token) else {
                return (0, defaultWindow, defaultTrigger)
            }
            let settingsDecoded = try JSONDecoder().decode(QualityThresholdAlertSettingsEnvelope.self, from: settingsResult.data)
            let windowHours = settingsDecoded.data.windowHours
            let deltaTrigger = settingsDecoded.data.largeDeltaThreshold

            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            let now = Date()
            let from = Calendar(identifier: .gregorian).date(byAdding: .hour, value: -windowHours, to: now) ?? now
            let dateFrom = formatter.string(from: from)
            let dateTo = formatter.string(from: now)
            guard let historyURL = URL(string: "\(normalizedBaseURL)/kpis/quality/threshold/history?date_from=\(dateFrom)&date_to=\(dateTo)&page=1&per_page=100") else {
                return (0, windowHours, deltaTrigger)
            }
            guard let historyResult = try await authorizedGet(url: historyURL, normalizedBaseURL: normalizedBaseURL, token: settingsResult.token) else {
                return (0, windowHours, deltaTrigger)
            }
            let historyDecoded = try JSONDecoder().decode(QualityThresholdHistoryEnvelope.self, from: historyResult.data)
            let count = historyDecoded.data.filter { $0.event == "quality.threshold.alert.large_delta" }.count
            return (count, windowHours, deltaTrigger)
        } catch {
            return (0, defaultWindow, defaultTrigger)
        }
    }

    private func fetchThresholdDeltaTopScopes(normalizedBaseURL: String, token: String?) async -> [TVThresholdAlertTopScope] {
        guard let url = URL(string: "\(normalizedBaseURL)/kpis/quality/threshold/history/alerts/top-scopes?limit=5") else {
            return []
        }

        do {
            guard let result = try await authorizedGet(url: url, normalizedBaseURL: normalizedBaseURL, token: token) else {
                return []
            }
            let decoded = try JSONDecoder().decode(QualityThresholdTopScopesEnvelope.self, from: result.data)
            return decoded.data.map {
                TVThresholdAlertTopScope(
                    scopeType: $0.scopeType,
                    scopeId: $0.scopeId,
                    scopeLabel: $0.scopeLabel,
                    alertsCount: $0.alertsCount
                )
            }
        } catch {
            return []
        }
    }

    private func fetchThresholdFromAPI(normalizedBaseURL: String, token: String?, fallbackThreshold: Double) async -> Double {
        guard let url = URL(string: "\(normalizedBaseURL)/kpis/quality/threshold") else {
            return fallbackThreshold
        }

        do {
            guard let result = try await authorizedGet(url: url, normalizedBaseURL: normalizedBaseURL, token: token) else {
                return fallbackThreshold
            }
            let decoded = try JSONDecoder().decode(QualityThresholdEnvelope.self, from: result.data)
            return decoded.data.threshold
        } catch {
            return fallbackThreshold
        }
    }

    private func fetchRouteBreakdownFromAPI(normalizedBaseURL: String, token: String?, routeId: String?) async -> TVRouteBreakdown? {
        guard let routeId, let url = URL(string: "\(normalizedBaseURL)/kpis/quality/routes/\(routeId)/breakdown") else {
            return nil
        }

        do {
            guard let result = try await authorizedGet(url: url, normalizedBaseURL: normalizedBaseURL, token: token) else {
                return nil
            }
            let decoded = try JSONDecoder().decode(RouteBreakdownEnvelope.self, from: result.data)
            return TVRouteBreakdown(
                routeId: decoded.data.routeId,
                routeCode: decoded.data.routeCode ?? decoded.data.routeId,
                score: decoded.data.serviceQualityScore,
                assigned: decoded.data.components.assignedWithAttempt,
                completed: decoded.data.components.completedTotal,
                failed: decoded.data.components.failedCount,
                absent: decoded.data.components.absentCount,
                retry: decoded.data.components.retryCount
            )
        } catch {
            return nil
        }
    }

    private func mockRouteQuality() -> [TVRouteQuality] {
        [
            TVRouteQuality(id: "rq-1", routeId: "r-1", routeCode: "R-AGP-20260227", score: 96.10, assigned: 120, completed: 115),
            TVRouteQuality(id: "rq-2", routeId: "r-2", routeCode: "R-AGP-20260228", score: 94.50, assigned: 98, completed: 93),
            TVRouteQuality(id: "rq-3", routeId: "r-3", routeCode: "R-AGP-20260301", score: 97.20, assigned: 110, completed: 107),
        ]
    }

    private func mockDriverQuality() -> [TVDriverQuality] {
        [
            TVDriverQuality(id: "dq-1", driverId: "d-1", driverCode: "DRV-AGP-001", score: 96.0, assigned: 160, completed: 154),
            TVDriverQuality(id: "dq-2", driverId: "d-2", driverCode: "DRV-AGP-002", score: 93.5, assigned: 140, completed: 131),
        ]
    }

    private func mockSubcontractorQuality() -> [TVSubcontractorQuality] {
        [
            TVSubcontractorQuality(id: "sq-1", subcontractorId: "sub-1", subcontractorCode: "Rapid Last Mile", score: 95.8, assigned: 320, completed: 306),
            TVSubcontractorQuality(id: "sq-2", subcontractorId: "sub-2", subcontractorCode: "ThermoParcel", score: 93.4, assigned: 280, completed: 261),
        ]
    }

    private func mockRouteBreakdown() -> TVRouteBreakdown {
        TVRouteBreakdown(
            routeId: "r-2",
            routeCode: "R-AGP-20260228",
            score: 94.5,
            assigned: 98,
            completed: 93,
            failed: 3,
            absent: 1,
            retry: 1
        )
    }

    private func fetchDriverBreakdownFromAPI(normalizedBaseURL: String, token: String?, driverId: String?) async -> TVDriverBreakdown? {
        guard let driverId, let url = URL(string: "\(normalizedBaseURL)/kpis/quality/drivers/\(driverId)/breakdown") else {
            return nil
        }
        do {
            guard let result = try await authorizedGet(url: url, normalizedBaseURL: normalizedBaseURL, token: token) else {
                return nil
            }
            let decoded = try JSONDecoder().decode(DriverBreakdownEnvelope.self, from: result.data)
            return TVDriverBreakdown(
                driverId: decoded.data.driverId,
                driverCode: decoded.data.driverCode ?? decoded.data.driverId,
                score: decoded.data.serviceQualityScore,
                assigned: decoded.data.components.assignedWithAttempt,
                completed: decoded.data.components.completedTotal,
                failed: decoded.data.components.failedCount,
                absent: decoded.data.components.absentCount,
                retry: decoded.data.components.retryCount
            )
        } catch {
            return nil
        }
    }

    private func mockDriverBreakdown() -> TVDriverBreakdown {
        TVDriverBreakdown(
            driverId: "d-2",
            driverCode: "DRV-AGP-002",
            score: 93.5,
            assigned: 140,
            completed: 131,
            failed: 5,
            absent: 3,
            retry: 1
        )
    }

    private func fetchSubcontractorBreakdownFromAPI(normalizedBaseURL: String, token: String?, subcontractorId: String?) async -> TVSubcontractorBreakdown? {
        guard let subcontractorId, let url = URL(string: "\(normalizedBaseURL)/kpis/quality/subcontractors/\(subcontractorId)/breakdown") else {
            return nil
        }
        do {
            guard let result = try await authorizedGet(url: url, normalizedBaseURL: normalizedBaseURL, token: token) else {
                return nil
            }
            let decoded = try JSONDecoder().decode(SubcontractorBreakdownEnvelope.self, from: result.data)
            return TVSubcontractorBreakdown(
                subcontractorId: decoded.data.subcontractorId,
                subcontractorCode: decoded.data.subcontractorCode ?? decoded.data.subcontractorId,
                score: decoded.data.serviceQualityScore,
                assigned: decoded.data.components.assignedWithAttempt,
                completed: decoded.data.components.completedTotal,
                failed: decoded.data.components.failedCount,
                absent: decoded.data.components.absentCount,
                retry: decoded.data.components.retryCount
            )
        } catch {
            return nil
        }
    }

    private func mockSubcontractorBreakdown() -> TVSubcontractorBreakdown {
        TVSubcontractorBreakdown(
            subcontractorId: "sub-2",
            subcontractorCode: "ThermoParcel",
            score: 93.4,
            assigned: 280,
            completed: 261,
            failed: 10,
            absent: 6,
            retry: 3
        )
    }
}

private struct QualityEnvelope: Decodable {
    let data: [RouteQualityPayload]
}

private struct RouteQualityPayload: Decodable {
    let id: String
    let scopeId: String
    let scopeLabel: String?
    let serviceQualityScore: Double
    let assignedWithAttempt: Int
    let deliveredCompleted: Int
    let pickupsCompleted: Int

    enum CodingKeys: String, CodingKey {
        case id
        case scopeId = "scope_id"
        case scopeLabel = "scope_label"
        case serviceQualityScore = "service_quality_score"
        case assignedWithAttempt = "assigned_with_attempt"
        case deliveredCompleted = "delivered_completed"
        case pickupsCompleted = "pickups_completed"
    }
}

private struct RouteBreakdownEnvelope: Decodable {
    let data: RouteBreakdownPayload
}

private struct RouteBreakdownPayload: Decodable {
    let routeId: String
    let routeCode: String?
    let serviceQualityScore: Double
    let components: RouteBreakdownComponentsPayload

    enum CodingKeys: String, CodingKey {
        case routeId = "route_id"
        case routeCode = "route_code"
        case serviceQualityScore = "service_quality_score"
        case components
    }
}

private struct RouteBreakdownComponentsPayload: Decodable {
    let assignedWithAttempt: Int
    let completedTotal: Int
    let failedCount: Int
    let absentCount: Int
    let retryCount: Int

    enum CodingKeys: String, CodingKey {
        case assignedWithAttempt = "assigned_with_attempt"
        case completedTotal = "completed_total"
        case failedCount = "failed_count"
        case absentCount = "absent_count"
        case retryCount = "retry_count"
    }
}

private struct DriverBreakdownEnvelope: Decodable {
    let data: DriverBreakdownPayload
}

private struct DriverBreakdownPayload: Decodable {
    let driverId: String
    let driverCode: String?
    let serviceQualityScore: Double
    let components: RouteBreakdownComponentsPayload

    enum CodingKeys: String, CodingKey {
        case driverId = "driver_id"
        case driverCode = "driver_code"
        case serviceQualityScore = "service_quality_score"
        case components
    }
}

private struct SubcontractorBreakdownEnvelope: Decodable {
    let data: SubcontractorBreakdownPayload
}

private struct SubcontractorBreakdownPayload: Decodable {
    let subcontractorId: String
    let subcontractorCode: String?
    let serviceQualityScore: Double
    let components: RouteBreakdownComponentsPayload

    enum CodingKeys: String, CodingKey {
        case subcontractorId = "subcontractor_id"
        case subcontractorCode = "subcontractor_code"
        case serviceQualityScore = "service_quality_score"
        case components
    }
}

private struct QualityThresholdEnvelope: Decodable {
    let data: QualityThresholdPayload
}

private struct QualityThresholdPayload: Decodable {
    let threshold: Double
}

private struct QualityThresholdAlertSettingsEnvelope: Decodable {
    let data: QualityThresholdAlertSettingsPayload
}

private struct QualityThresholdAlertSettingsPayload: Decodable {
    let largeDeltaThreshold: Double
    let windowHours: Int

    enum CodingKeys: String, CodingKey {
        case largeDeltaThreshold = "large_delta_threshold"
        case windowHours = "window_hours"
    }
}

private struct QualityThresholdHistoryEnvelope: Decodable {
    let data: [QualityThresholdHistoryPayload]
}

private struct QualityThresholdHistoryPayload: Decodable {
    let event: String
}

private struct QualityThresholdTopScopesEnvelope: Decodable {
    let data: [QualityThresholdTopScopePayload]
}

private struct QualityThresholdTopScopePayload: Decodable {
    let scopeType: String
    let scopeId: String?
    let scopeLabel: String?
    let alertsCount: Int

    enum CodingKeys: String, CodingKey {
        case scopeType = "scope_type"
        case scopeId = "scope_id"
        case scopeLabel = "scope_label"
        case alertsCount = "alerts_count"
    }
}

private struct LoginEnvelope: Decodable {
    let token: String
}

private extension View {
    @ViewBuilder
    func ecoPanelStyle(cornerRadius: CGFloat = 12) -> some View {
        if #available(tvOS 26.0, *) {
            self
                .glassEffect(.regular.tint(.teal.opacity(0.08)).interactive(), in: .rect(cornerRadius: cornerRadius))
        } else {
            self
                .background(.thinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        }
    }
}
