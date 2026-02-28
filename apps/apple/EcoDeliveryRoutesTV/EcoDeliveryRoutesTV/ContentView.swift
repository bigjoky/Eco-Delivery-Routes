import Foundation
import SwiftUI

struct ContentView: View {
    let monitorService: TVMonitorService

    @State private var users: [TVUser] = []
    @State private var roles: [TVRole] = []
    @State private var routeQuality: [TVRouteQuality] = []
    @State private var driverQuality: [TVDriverQuality] = []
    @State private var routeBreakdown: TVRouteBreakdown?
    @State private var driverBreakdown: TVDriverBreakdown?
    @State private var lastRefreshText: String = "Sin refresco"
    @State private var statusText: String = "Conectando..."

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Eco Delivery Routes Monitor")
                .font(.largeTitle)

            Text(statusText)
                .foregroundStyle(.secondary)

            HStack(spacing: 32) {
                VStack(alignment: .leading) {
                    Text("Usuarios")
                        .font(.headline)
                    Text("\(users.count)")
                        .font(.title)
                }
                VStack(alignment: .leading) {
                    Text("Roles")
                        .font(.headline)
                    Text("\(roles.count)")
                        .font(.title)
                }
                VStack(alignment: .leading) {
                    Text("Rutas KPI")
                        .font(.headline)
                    Text("\(routeQuality.count)")
                        .font(.title)
                }
                VStack(alignment: .leading) {
                    Text("Conductores KPI")
                        .font(.headline)
                    Text("\(driverQuality.count)")
                        .font(.title)
                }
            }

            HStack(spacing: 40) {
                VStack(alignment: .leading) {
                    Text("Últimos usuarios")
                        .font(.headline)
                    ForEach(users.prefix(5)) { user in
                        Text(user.name)
                    }
                }
                VStack(alignment: .leading) {
                    Text("Roles disponibles")
                        .font(.headline)
                    ForEach(roles.prefix(5)) { role in
                        Text(role.name)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Calidad por ruta")
                    .font(.headline)
                ForEach(routeQuality.prefix(6)) { item in
                    Text("\(item.routeCode) · \(item.score, specifier: "%.2f")% · \(item.completed)/\(item.assigned)")
                }
            }

            if let routeBreakdown {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Desglose ruta en riesgo")
                        .font(.headline)
                    Text("\(routeBreakdown.routeCode) · \(routeBreakdown.score, specifier: "%.2f")%")
                    Text("Asignados: \(routeBreakdown.assigned) · Completados: \(routeBreakdown.completed)")
                    Text("Fallidas: \(routeBreakdown.failed) · Ausencias: \(routeBreakdown.absent) · Reintentos: \(routeBreakdown.retry)")
                        .foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Calidad por conductor")
                    .font(.headline)
                ForEach(driverQuality.prefix(6)) { item in
                    Text("\(item.driverCode) · \(item.score, specifier: "%.2f")% · \(item.completed)/\(item.assigned)")
                }
            }

            if let driverBreakdown {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Desglose conductor en riesgo")
                        .font(.headline)
                    Text("\(driverBreakdown.driverCode) · \(driverBreakdown.score, specifier: "%.2f")%")
                    Text("Asignados: \(driverBreakdown.assigned) · Completados: \(driverBreakdown.completed)")
                    Text("Fallidas: \(driverBreakdown.failed) · Ausencias: \(driverBreakdown.absent) · Reintentos: \(driverBreakdown.retry)")
                        .foregroundStyle(.secondary)
                }
            }

            Text(lastRefreshText)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .task {
            await startPolling()
        }
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
        routeBreakdown = payload.routeBreakdown
        driverBreakdown = payload.driverBreakdown
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
    let routeBreakdown: TVRouteBreakdown?
    let driverBreakdown: TVDriverBreakdown?
    let status: String
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

final class TVMonitorService {
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
            routeBreakdown: apiSnapshot.routeBreakdown,
            driverBreakdown: apiSnapshot.driverBreakdown,
            status: apiSnapshot.status
        )
    }

    private func fetchQualityFromAPI() async -> (
        routeQuality: [TVRouteQuality],
        driverQuality: [TVDriverQuality],
        routeBreakdown: TVRouteBreakdown?,
        driverBreakdown: TVDriverBreakdown?,
        status: String
    ) {
        guard
            let rawBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"],
            !rawBaseURL.isEmpty
        else {
            return (
                mockRouteQuality(),
                mockDriverQuality(),
                mockRouteBreakdown(),
                mockDriverBreakdown(),
                "Monitor activo (solo lectura/mock)"
            )
        }

        let normalizedBaseURL = rawBaseURL.hasSuffix("/v1") ? rawBaseURL : "\(rawBaseURL)/v1"
        guard
            let routeURL = URL(string: "\(normalizedBaseURL)/kpis/quality?scope_type=route"),
            let driverURL = URL(string: "\(normalizedBaseURL)/kpis/quality?scope_type=driver")
        else {
            return (
                mockRouteQuality(),
                mockDriverQuality(),
                mockRouteBreakdown(),
                mockDriverBreakdown(),
                "Monitor activo (URL invalida, fallback mock)"
            )
        }

        var routeRequest = URLRequest(url: routeURL)
        routeRequest.httpMethod = "GET"
        var driverRequest = URLRequest(url: driverURL)
        driverRequest.httpMethod = "GET"
        let token = ProcessInfo.processInfo.environment["API_TOKEN"]
        if let token, !token.isEmpty {
            routeRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            driverRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (routeData, routeResponse) = try await URLSession.shared.data(for: routeRequest)
            let (driverData, driverResponse) = try await URLSession.shared.data(for: driverRequest)
            guard
                let routeHTTP = routeResponse as? HTTPURLResponse, (200...299).contains(routeHTTP.statusCode),
                let driverHTTP = driverResponse as? HTTPURLResponse, (200...299).contains(driverHTTP.statusCode)
            else {
                return (
                    mockRouteQuality(),
                    mockDriverQuality(),
                    mockRouteBreakdown(),
                    mockDriverBreakdown(),
                    "Monitor fallback (error HTTP API calidad)"
                )
            }

            let routeDecoded = try JSONDecoder().decode(QualityEnvelope.self, from: routeData)
            let driverDecoded = try JSONDecoder().decode(QualityEnvelope.self, from: driverData)
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

            if mappedRoutes.isEmpty && mappedDrivers.isEmpty {
                return (
                    mockRouteQuality(),
                    mockDriverQuality(),
                    mockRouteBreakdown(),
                    mockDriverBreakdown(),
                    "Monitor API sin datos, fallback mock"
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
            return (mappedRoutes, mappedDrivers, routeBreakdown, driverBreakdown, "Monitor activo (API real)")
        } catch {
            return (
                mockRouteQuality(),
                mockDriverQuality(),
                mockRouteBreakdown(),
                mockDriverBreakdown(),
                "Monitor fallback (error conexion API)"
            )
        }
    }

    private func fetchRouteBreakdownFromAPI(normalizedBaseURL: String, token: String?, routeId: String?) async -> TVRouteBreakdown? {
        guard let routeId, let url = URL(string: "\(normalizedBaseURL)/kpis/quality/routes/\(routeId)/breakdown") else {
            return nil
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            let decoded = try JSONDecoder().decode(RouteBreakdownEnvelope.self, from: data)
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
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            let decoded = try JSONDecoder().decode(DriverBreakdownEnvelope.self, from: data)
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
