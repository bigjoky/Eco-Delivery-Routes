import Foundation
import SwiftUI

struct ContentView: View {
    let monitorService: TVMonitorService

    @State private var snapshot = TVDashboardSnapshot.empty
    @State private var lastRefresh = "Sin refresco"
    @State private var period = "7d"
    @State private var hubID = ProcessInfo.processInfo.environment["TV_HUB_ID"] ?? ""
    @State private var subcontractorID = ProcessInfo.processInfo.environment["TV_SUBCONTRACTOR_ID"] ?? ""

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.10, blue: 0.18),
                    Color(red: 0.07, green: 0.18, blue: 0.26),
                    Color(red: 0.13, green: 0.14, blue: 0.08),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Eco Delivery Routes")
                            .font(.system(size: 52, weight: .bold))
                        Text("Monitor tvOS · \(snapshot.status)")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                        Text(lastRefresh)
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: 12) {
                        metricCard("Rutas", value: "\(snapshot.routeRows.count)")
                        metricCard("Conductores", value: "\(snapshot.driverRows.count)")
                        metricCard("Subcontratas", value: "\(snapshot.subcontractorRows.count)")
                        metricCard("Umbral KPI", value: "\(formatPercent(snapshot.threshold))%")
                        metricCard("Nodos red", value: "\(snapshot.hubsCount)/\(snapshot.depotsCount)/\(snapshot.pointsCount)")
                    }
                    HStack(spacing: 12) {
                        Button("Hoy") { period = "today" }
                            .buttonStyle(.borderedProminent)
                        Button("7d") { period = "7d" }
                            .buttonStyle(.bordered)
                        Button("30d") { period = "30d" }
                            .buttonStyle(.bordered)
                        Spacer()
                        Text("Hub: \(hubID.isEmpty ? "Todos" : hubID)")
                        Text("Subcontrata: \(subcontractorID.isEmpty ? "Todas" : subcontractorID)")
                    }

                    HStack(alignment: .top, spacing: 14) {
                        qualityColumn(
                            title: "Rutas en riesgo",
                            rows: snapshot.routeRows.prefix(6).map {
                                "\($0.label) · \(formatPercent($0.score))%"
                            }
                        )
                        qualityColumn(
                            title: "Conductores en riesgo",
                            rows: snapshot.driverRows.prefix(6).map {
                                "\($0.label) · \(formatPercent($0.score))%"
                            }
                        )
                        qualityColumn(
                            title: "Subcontratas en riesgo",
                            rows: snapshot.subcontractorRows.prefix(6).map {
                                "\($0.label) · \(formatPercent($0.score))%"
                            }
                        )
                    }

                    qualityColumn(
                        title: "Alertas KPI < \(formatPercent(snapshot.threshold))%",
                        rows: snapshot.alerts
                    )
                }
                .padding(36)
            }
        }
        .task { await startPolling() }
    }

    private func metricCard(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.title3.weight(.semibold))
            Text(value)
                .font(.system(size: 34, weight: .bold))
        }
        .frame(maxWidth: .infinity, minHeight: 110, alignment: .leading)
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(.ultraThinMaterial))
    }

    private func qualityColumn(title: String, rows: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.title2.weight(.semibold))
            if rows.isEmpty {
                Text("Sin datos.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(rows, id: \.self) { row in
                    Text(row)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(.ultraThinMaterial))
    }

    private func formatPercent(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private func startPolling() async {
        while !Task.isCancelled {
            snapshot = await monitorService.loadSnapshot(
                period: period,
                hubId: hubID.isEmpty ? nil : hubID,
                subcontractorId: subcontractorID.isEmpty ? nil : subcontractorID
            )
            let formatter = DateFormatter()
            formatter.timeStyle = .medium
            formatter.dateStyle = .none
            lastRefresh = "Ultima actualizacion: \(formatter.string(from: Date()))"
            try? await Task.sleep(nanoseconds: 30_000_000_000)
        }
    }
}

struct TVDashboardSnapshot {
    struct QualityRow: Identifiable {
        let id: String
        let label: String
        let score: Double
    }

    let routeRows: [QualityRow]
    let driverRows: [QualityRow]
    let subcontractorRows: [QualityRow]
    let threshold: Double
    let hubsCount: Int
    let depotsCount: Int
    let pointsCount: Int
    let status: String
    let alerts: [String]

    static let empty = TVDashboardSnapshot(
        routeRows: [],
        driverRows: [],
        subcontractorRows: [],
        threshold: 95,
        hubsCount: 0,
        depotsCount: 0,
        pointsCount: 0,
        status: "Inicializando",
        alerts: []
    )
}

final class TVMonitorService {
    private struct LoginResponse: Decodable {
        let token: String
    }

    private struct DataEnvelope<T: Decodable>: Decodable {
        let data: [T]
    }

    private struct DataObjectEnvelope<T: Decodable>: Decodable {
        let data: T
    }

    private struct DashboardOverviewDTO: Decodable {
        struct Totals: Decodable {
            let routes: Int
            let qualityThreshold: Double

            enum CodingKeys: String, CodingKey {
                case routes
                case qualityThreshold = "quality_threshold"
            }
        }

        struct Alert: Decodable {
            let id: String
            let title: String
            let count: Int
        }

        struct Sla: Decodable {
            let onTrack: Int
            let atRisk: Int
            let breached: Int

            enum CodingKeys: String, CodingKey {
                case onTrack = "on_track"
                case atRisk = "at_risk"
                case breached
            }
        }

        let totals: Totals
        let alerts: [Alert]
        let sla: Sla
    }

    private struct QualityRowDTO: Decodable {
        let id: String
        let scopeId: String
        let scopeLabel: String?
        let serviceQualityScore: Double

        enum CodingKeys: String, CodingKey {
            case id
            case scopeId = "scope_id"
            case scopeLabel = "scope_label"
            case serviceQualityScore = "service_quality_score"
        }
    }

    private struct ThresholdDTO: Decodable {
        let threshold: Double
    }

    private let rawBaseURL: String
    private let apiEmail: String?
    private let apiPassword: String?
    private let exportDashboardCsvOnBoot: Bool
    private let exportDashboardPdfOnBoot: Bool
    private var token: String?
    private var didTriggerBootExports = false

    init() {
        rawBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? ""
        apiEmail = ProcessInfo.processInfo.environment["API_EMAIL"]
        apiPassword = ProcessInfo.processInfo.environment["API_PASSWORD"]
        exportDashboardCsvOnBoot = (ProcessInfo.processInfo.environment["TV_EXPORT_DASHBOARD_CSV_ON_BOOT"] ?? "") == "1"
        exportDashboardPdfOnBoot = (ProcessInfo.processInfo.environment["TV_EXPORT_DASHBOARD_PDF_ON_BOOT"] ?? "") == "1"
        token = ProcessInfo.processInfo.environment["API_TOKEN"]
    }

    func loadSnapshot(period: String = "7d", hubId: String? = nil, subcontractorId: String? = nil) async -> TVDashboardSnapshot {
        guard let baseURL = normalizedBaseURL() else {
            return mockSnapshot(status: "Sin API_BASE_URL configurada")
        }

        await ensureAuthenticated(baseURL: baseURL)
        await triggerBootExportsIfNeeded(baseURL: baseURL, period: period, hubId: hubId, subcontractorId: subcontractorId)

        do {
            async let overview = fetchOverview(
                baseURL: baseURL,
                period: period,
                hubId: hubId,
                subcontractorId: subcontractorId
            )
            async let routesDTO = fetchQuality(baseURL: baseURL, scope: "route", hubId: hubId, subcontractorId: subcontractorId)
            async let driversDTO = fetchQuality(baseURL: baseURL, scope: "driver", hubId: hubId, subcontractorId: subcontractorId)
            async let subcontractorsDTO = fetchQuality(baseURL: baseURL, scope: "subcontractor", hubId: hubId, subcontractorId: subcontractorId)
            async let hubsCount = fetchRowsCount(baseURL: baseURL, path: "hubs?only_active=1&include_deleted=0")
            async let depotsCount = fetchRowsCount(baseURL: baseURL, path: "depots?include_deleted=0\(hubId != nil ? "&hub_id=\(hubId!)" : "")")
            async let pointsCount = fetchRowsCount(baseURL: baseURL, path: "points?include_deleted=0\(hubId != nil ? "&hub_id=\(hubId!)" : "")")

            let overviewDTO = try await overview
            let routes = mapRows(try await routesDTO)
            let drivers = mapRows(try await driversDTO)
            let subcontractors = mapRows(try await subcontractorsDTO)
            let thresholdValue = overviewDTO.totals.qualityThreshold
            let alerts = buildAlerts(threshold: thresholdValue, routes: routes, drivers: drivers, subcontractors: subcontractors)
            let overviewAlerts = overviewDTO.alerts.map { "\($0.title): \($0.count)" }
            let slaSummary = "SLA · OnTrack \(overviewDTO.sla.onTrack) · AtRisk \(overviewDTO.sla.atRisk) · Breached \(overviewDTO.sla.breached)"

            return TVDashboardSnapshot(
                routeRows: routes,
                driverRows: drivers,
                subcontractorRows: subcontractors,
                threshold: thresholdValue,
                hubsCount: try await hubsCount,
                depotsCount: try await depotsCount,
                pointsCount: try await pointsCount,
                status: "Conectado",
                alerts: [slaSummary] + overviewAlerts + alerts
            )
        } catch {
            return mockSnapshot(status: "Error API")
        }
    }

    private func normalizedBaseURL() -> String? {
        guard !rawBaseURL.isEmpty else { return nil }
        return rawBaseURL.hasSuffix("/v1") ? rawBaseURL : "\(rawBaseURL)/v1"
    }

    private func ensureAuthenticated(baseURL: String) async {
        if let token, !token.isEmpty { return }
        guard
            let apiEmail, !apiEmail.isEmpty,
            let apiPassword, !apiPassword.isEmpty,
            let loginURL = URL(string: "\(baseURL)/auth/login")
        else {
            return
        }

        var request = URLRequest(url: loginURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "email": apiEmail,
            "password": apiPassword,
            "device_name": "apple-tv-monitor",
        ])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return }
            let decoded = try JSONDecoder().decode(LoginResponse.self, from: data)
            token = decoded.token
        } catch {
            token = nil
        }
    }

    private func fetchQuality(baseURL: String, scope: String, hubId: String?, subcontractorId: String?) async throws -> [QualityRowDTO] {
        var queryItems = [
            URLQueryItem(name: "scope_type", value: scope),
            URLQueryItem(name: "hub_id", value: hubId),
            URLQueryItem(name: "subcontractor_id", value: subcontractorId),
        ]
        queryItems.removeAll(where: { $0.value == nil || $0.value?.isEmpty == true })
        var components = URLComponents(string: "\(baseURL)/kpis/quality")
        components?.queryItems = queryItems
        guard let url = components?.url else { return [] }
        let data = try await authorizedGet(url: url, baseURL: baseURL)
        return try JSONDecoder().decode(DataEnvelope<QualityRowDTO>.self, from: data).data
    }

    private func fetchThreshold(baseURL: String) async throws -> Double {
        guard let url = URL(string: "\(baseURL)/kpis/quality/threshold") else { return 95 }
        let data = try await authorizedGet(url: url, baseURL: baseURL)
        return try JSONDecoder().decode(DataObjectEnvelope<ThresholdDTO>.self, from: data).data.threshold
    }

    private func fetchOverview(baseURL: String, period: String, hubId: String?, subcontractorId: String?) async throws -> DashboardOverviewDTO {
        var components = URLComponents(string: "\(baseURL)/dashboard/overview")
        components?.queryItems = [
            URLQueryItem(name: "period", value: period),
            URLQueryItem(name: "hub_id", value: hubId),
            URLQueryItem(name: "subcontractor_id", value: subcontractorId),
        ].filter { $0.value != nil && $0.value?.isEmpty == false }
        guard let url = components?.url else {
            throw URLError(.badURL)
        }
        let data = try await authorizedGet(url: url, baseURL: baseURL)
        return try JSONDecoder().decode(DataObjectEnvelope<DashboardOverviewDTO>.self, from: data).data
    }

    private func fetchRowsCount(baseURL: String, path: String) async throws -> Int {
        guard let url = URL(string: "\(baseURL)/\(path)") else { return 0 }
        let data = try await authorizedGet(url: url, baseURL: baseURL)
        let rows = try JSONDecoder().decode(DataEnvelope<NetworkRowDTO>.self, from: data).data
        return rows.count
    }

    private func triggerBootExportsIfNeeded(baseURL: String, period: String, hubId: String?, subcontractorId: String?) async {
        if didTriggerBootExports { return }
        didTriggerBootExports = true

        if exportDashboardCsvOnBoot {
            _ = try? await fetchOverviewExport(baseURL: baseURL, period: period, hubId: hubId, subcontractorId: subcontractorId, format: "csv")
        }
        if exportDashboardPdfOnBoot {
            _ = try? await fetchOverviewExport(baseURL: baseURL, period: period, hubId: hubId, subcontractorId: subcontractorId, format: "pdf")
        }
    }

    private func fetchOverviewExport(baseURL: String, period: String, hubId: String?, subcontractorId: String?, format: String) async throws -> Data {
        var components = URLComponents(string: "\(baseURL)/dashboard/overview/export.\(format)")
        components?.queryItems = [
            URLQueryItem(name: "period", value: period),
            URLQueryItem(name: "hub_id", value: hubId),
            URLQueryItem(name: "subcontractor_id", value: subcontractorId),
        ].filter { $0.value != nil && $0.value?.isEmpty == false }
        guard let url = components?.url else { throw URLError(.badURL) }
        return try await authorizedGet(url: url, baseURL: baseURL)
    }

    private struct NetworkRowDTO: Decodable {
        let id: String
    }

    private func authorizedGet(url: URL, baseURL: String) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 401 {
            token = nil
            await ensureAuthenticated(baseURL: baseURL)
            var retry = URLRequest(url: url)
            retry.httpMethod = "GET"
            if let token, !token.isEmpty {
                retry.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            return try await URLSession.shared.data(for: retry).0
        }
        return data
    }

    private func mapRows(_ rows: [QualityRowDTO]) -> [TVDashboardSnapshot.QualityRow] {
        rows
            .map {
                TVDashboardSnapshot.QualityRow(
                    id: $0.id,
                    label: $0.scopeLabel ?? $0.scopeId,
                    score: $0.serviceQualityScore
                )
            }
            .sorted(by: { $0.score < $1.score })
    }

    private func buildAlerts(
        threshold: Double,
        routes: [TVDashboardSnapshot.QualityRow],
        drivers: [TVDashboardSnapshot.QualityRow],
        subcontractors: [TVDashboardSnapshot.QualityRow]
    ) -> [String] {
        let routeAlerts = routes.filter { $0.score < threshold }.prefix(3).map {
            "Ruta \($0.label): \(String(format: "%.2f", $0.score))%"
        }
        let driverAlerts = drivers.filter { $0.score < threshold }.prefix(3).map {
            "Conductor \($0.label): \(String(format: "%.2f", $0.score))%"
        }
        let subcontractorAlerts = subcontractors.filter { $0.score < threshold }.prefix(3).map {
            "Subcontrata \($0.label): \(String(format: "%.2f", $0.score))%"
        }
        let alerts = Array(routeAlerts + driverAlerts + subcontractorAlerts)
        return alerts.isEmpty ? ["Sin alertas por debajo del umbral."] : alerts
    }

    private func mockSnapshot(status: String) -> TVDashboardSnapshot {
        TVDashboardSnapshot(
            routeRows: [
                .init(id: "r1", label: "R-AGP-01", score: 92.4),
                .init(id: "r2", label: "R-AGP-02", score: 95.8),
            ],
            driverRows: [
                .init(id: "d1", label: "DRV-01", score: 93.2),
                .init(id: "d2", label: "DRV-02", score: 97.1),
            ],
            subcontractorRows: [
                .init(id: "s1", label: "SUB-01", score: 94.0),
            ],
            threshold: 95,
            hubsCount: 2,
            depotsCount: 4,
            pointsCount: 8,
            status: status,
            alerts: ["Monitor en modo fallback por falta de conexion."]
        )
    }
}

#Preview {
    ContentView(monitorService: TVMonitorService())
}
