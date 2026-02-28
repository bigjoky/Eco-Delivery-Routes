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
                VStack(alignment: .leading) {
                    Text("Subcontratas KPI")
                        .font(.headline)
                    Text("\(subcontractorQuality.count)")
                        .font(.title)
                }
                VStack(alignment: .leading) {
                    Text("Alertas delta")
                        .font(.headline)
                    Text("\(thresholdDeltaAlertCount)")
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

            VStack(alignment: .leading, spacing: 8) {
                Text("Calidad por subcontrata")
                    .font(.headline)
                ForEach(subcontractorQuality.prefix(6)) { item in
                    Text("\(item.subcontractorCode) · \(item.score, specifier: "%.2f")% · \(item.completed)/\(item.assigned)")
                }
            }

            if let subcontractorBreakdown {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Desglose subcontrata en riesgo")
                        .font(.headline)
                    Text("\(subcontractorBreakdown.subcontractorCode) · \(subcontractorBreakdown.score, specifier: "%.2f")%")
                    Text("Asignados: \(subcontractorBreakdown.assigned) · Completados: \(subcontractorBreakdown.completed)")
                    Text("Fallidas: \(subcontractorBreakdown.failed) · Ausencias: \(subcontractorBreakdown.absent) · Reintentos: \(subcontractorBreakdown.retry)")
                        .foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Alertas KPI < \(qualityThreshold, specifier: "%.2f")%")
                    .font(.headline)
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
        subcontractorQuality = payload.subcontractorQuality
        routeBreakdown = payload.routeBreakdown
        driverBreakdown = payload.driverBreakdown
        subcontractorBreakdown = payload.subcontractorBreakdown
        qualityThreshold = payload.threshold
        thresholdDeltaAlertCount = payload.thresholdDeltaAlertCount
        thresholdDeltaTopScopes = payload.thresholdDeltaTopScopes
        thresholdDeltaWindowHours = payload.thresholdDeltaWindowHours
        thresholdDeltaTrigger = payload.thresholdDeltaTrigger
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
                "Monitor activo (solo lectura/mock)"
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
                "Monitor activo (URL invalida, fallback mock)"
            )
        }

        var routeRequest = URLRequest(url: routeURL)
        routeRequest.httpMethod = "GET"
        var driverRequest = URLRequest(url: driverURL)
        driverRequest.httpMethod = "GET"
        var subcontractorRequest = URLRequest(url: subcontractorURL)
        subcontractorRequest.httpMethod = "GET"
        let token = ProcessInfo.processInfo.environment["API_TOKEN"]
        if let token, !token.isEmpty {
            routeRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            driverRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            subcontractorRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (routeData, routeResponse) = try await URLSession.shared.data(for: routeRequest)
            let (driverData, driverResponse) = try await URLSession.shared.data(for: driverRequest)
            let (subcontractorData, subcontractorResponse) = try await URLSession.shared.data(for: subcontractorRequest)
            guard
                let routeHTTP = routeResponse as? HTTPURLResponse, (200...299).contains(routeHTTP.statusCode),
                let driverHTTP = driverResponse as? HTTPURLResponse, (200...299).contains(driverHTTP.statusCode),
                let subcontractorHTTP = subcontractorResponse as? HTTPURLResponse, (200...299).contains(subcontractorHTTP.statusCode)
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
                    "Monitor fallback (error HTTP API calidad)"
                )
            }

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
                "Monitor fallback (error conexion API)"
            )
        }
    }

    private func fetchThresholdDeltaAlertSummary(normalizedBaseURL: String, token: String?) async -> (count: Int, windowHours: Int, deltaTrigger: Double) {
        let defaultWindow = 24
        let defaultTrigger = 5.0
        guard let settingsURL = URL(string: "\(normalizedBaseURL)/kpis/quality/threshold/alert-settings") else {
            return (0, defaultWindow, defaultTrigger)
        }

        var settingsRequest = URLRequest(url: settingsURL)
        settingsRequest.httpMethod = "GET"
        if let token, !token.isEmpty {
            settingsRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (settingsData, settingsResponse) = try await URLSession.shared.data(for: settingsRequest)
            guard let settingsHTTP = settingsResponse as? HTTPURLResponse, (200...299).contains(settingsHTTP.statusCode) else {
                return (0, defaultWindow, defaultTrigger)
            }
            let settingsDecoded = try JSONDecoder().decode(QualityThresholdAlertSettingsEnvelope.self, from: settingsData)
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

            var historyRequest = URLRequest(url: historyURL)
            historyRequest.httpMethod = "GET"
            if let token, !token.isEmpty {
                historyRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            let (historyData, historyResponse) = try await URLSession.shared.data(for: historyRequest)
            guard let historyHTTP = historyResponse as? HTTPURLResponse, (200...299).contains(historyHTTP.statusCode) else {
                return (0, windowHours, deltaTrigger)
            }
            let historyDecoded = try JSONDecoder().decode(QualityThresholdHistoryEnvelope.self, from: historyData)
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
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return []
            }
            let decoded = try JSONDecoder().decode(QualityThresholdTopScopesEnvelope.self, from: data)
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
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return fallbackThreshold
            }
            let decoded = try JSONDecoder().decode(QualityThresholdEnvelope.self, from: data)
            return decoded.data.threshold
        } catch {
            return fallbackThreshold
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

    private func fetchSubcontractorBreakdownFromAPI(normalizedBaseURL: String, token: String?, subcontractorId: String?) async -> TVSubcontractorBreakdown? {
        guard let subcontractorId, let url = URL(string: "\(normalizedBaseURL)/kpis/quality/subcontractors/\(subcontractorId)/breakdown") else {
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
            let decoded = try JSONDecoder().decode(SubcontractorBreakdownEnvelope.self, from: data)
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
