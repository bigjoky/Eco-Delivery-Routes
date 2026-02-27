import Foundation
import SwiftUI

struct ContentView: View {
    let monitorService: TVMonitorService

    @State private var users: [TVUser] = []
    @State private var roles: [TVRole] = []
    @State private var routeQuality: [TVRouteQuality] = []
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
    let status: String
}

struct TVRouteQuality: Identifiable {
    let id: String
    let routeCode: String
    let score: Double
    let assigned: Int
    let completed: Int
}

final class TVMonitorService {
    func snapshot() async -> TVSnapshot {
        let apiSnapshot = await fetchRouteQualityFromAPI()

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
            status: apiSnapshot.status
        )
    }

    private func fetchRouteQualityFromAPI() async -> (routeQuality: [TVRouteQuality], status: String) {
        guard
            let rawBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"],
            !rawBaseURL.isEmpty
        else {
            return (mockRouteQuality(), "Monitor activo (solo lectura/mock)")
        }

        let normalizedBaseURL = rawBaseURL.hasSuffix("/v1") ? rawBaseURL : "\(rawBaseURL)/v1"
        guard let url = URL(string: "\(normalizedBaseURL)/kpis/quality?scope_type=route") else {
            return (mockRouteQuality(), "Monitor activo (URL invalida, fallback mock)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = ProcessInfo.processInfo.environment["API_TOKEN"], !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return (mockRouteQuality(), "Monitor fallback (error HTTP API calidad)")
            }

            let decoded = try JSONDecoder().decode(QualityEnvelope.self, from: data)
            let mapped = decoded.data.map {
                TVRouteQuality(
                    id: $0.id,
                    routeCode: $0.scopeLabel ?? $0.scopeId,
                    score: $0.serviceQualityScore,
                    assigned: $0.assignedWithAttempt,
                    completed: $0.deliveredCompleted + $0.pickupsCompleted
                )
            }

            if mapped.isEmpty {
                return (mockRouteQuality(), "Monitor API sin datos, fallback mock")
            }
            return (mapped, "Monitor activo (API real)")
        } catch {
            return (mockRouteQuality(), "Monitor fallback (error conexion API)")
        }
    }

    private func mockRouteQuality() -> [TVRouteQuality] {
        [
            TVRouteQuality(id: "rq-1", routeCode: "R-AGP-20260227", score: 96.10, assigned: 120, completed: 115),
            TVRouteQuality(id: "rq-2", routeCode: "R-AGP-20260228", score: 94.50, assigned: 98, completed: 93),
            TVRouteQuality(id: "rq-3", routeCode: "R-AGP-20260301", score: 97.20, assigned: 110, completed: 107),
        ]
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
