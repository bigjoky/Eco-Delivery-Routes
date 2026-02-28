import SwiftUI
import SharedCore

@main
struct WarehouseMacApp: App {
    var body: some Scene {
        WindowGroup {
            MacRootView()
        }
    }
}

struct MacRootView: View {
    @State private var selectedSection: String? = "manifest"

    var body: some View {
        NavigationSplitView {
            List {
                NavigationLink("Login", value: "login")
                NavigationLink("Usuarios", value: "users")
                NavigationLink("Manifest", value: "manifest")
            }
        } detail: {
            switch selectedSection {
            case "manifest":
                WarehouseManifestView()
            case "login":
                Text("Login")
            case "users":
                Text("Usuarios")
            default:
                Text("Eco Delivery Routes macOS")
            }
        }
        .navigationSplitViewStyle(.balanced)
        .onAppear { selectedSection = "manifest" }
    }
}

struct WarehouseManifestRow: Identifiable {
    let id: String
    let sequence: Int
    let stopType: String
    let reference: String
    let status: String
}

private struct RouteManifestAPIResponse: Decodable {
    let data: RouteManifestPayload
}

private struct RouteManifestPayload: Decodable {
    let route: RouteManifestRoute
    let totals: RouteManifestTotals
    let stops: [RouteManifestStop]
    let generatedAt: String

    enum CodingKeys: String, CodingKey {
        case route
        case totals
        case stops
        case generatedAt = "generated_at"
    }
}

private struct RouteManifestRoute: Decodable {
    let id: String
    let code: String
    let routeDate: String
    let status: String
    let driverCode: String?
    let vehicleCode: String?

    enum CodingKeys: String, CodingKey {
        case id
        case code
        case routeDate = "route_date"
        case status
        case driverCode = "driver_code"
        case vehicleCode = "vehicle_code"
    }
}

private struct RouteManifestTotals: Decodable {
    let stops: Int
    let deliveries: Int
    let pickups: Int
    let completed: Int
}

private struct RouteManifestStop: Decodable {
    let id: String
    let sequence: Int
    let stopType: String
    let reference: String?
    let entityId: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case sequence
        case stopType = "stop_type"
        case reference
        case entityId = "entity_id"
        case status
    }
}

struct WarehouseManifestView: View {
    @State private var baseURL = "http://127.0.0.1:8000/api/v1"
    @State private var token = ""
    @State private var routeId = ""
    @State private var routeCode = "-"
    @State private var routeDate = "-"
    @State private var rows: [WarehouseManifestRow] = []
    @State private var totals = RouteManifestTotals(stops: 0, deliveries: 0, pickups: 0, completed: 0)
    @State private var isLoading = false
    @State private var loadError: String?

    private func loadManifest() async {
        let trimmedRouteId = routeId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedRouteId.isEmpty {
            loadError = "Indica un routeId para cargar el manifest."
            return
        }
        guard let url = URL(string: "\(baseURL)/routes/\(trimmedRouteId)/manifest") else {
            loadError = "Base URL invalida."
            return
        }

        isLoading = true
        loadError = nil
        defer { isLoading = false }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                loadError = "Respuesta invalida."
                return
            }
            guard (200...299).contains(http.statusCode) else {
                loadError = "Error HTTP \(http.statusCode). Verifica token/routeId."
                return
            }

            let decoded = try JSONDecoder().decode(RouteManifestAPIResponse.self, from: data).data
            routeCode = decoded.route.code
            routeDate = decoded.route.routeDate
            totals = decoded.totals
            rows = decoded.stops.map {
                WarehouseManifestRow(
                    id: $0.id,
                    sequence: $0.sequence,
                    stopType: $0.stopType,
                    reference: $0.reference ?? $0.entityId,
                    status: $0.status
                )
            }
        } catch {
            loadError = "No se pudo cargar manifest: \(error.localizedDescription)"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Manifest de Ruta")
                .font(.title2)
                .bold()
            HStack(spacing: 12) {
                Text("API")
                TextField("http://127.0.0.1:8000/api/v1", text: $baseURL)
                    .textFieldStyle(.roundedBorder)
                Text("Route ID")
                TextField("uuid route", text: $routeId)
                    .textFieldStyle(.roundedBorder)
                Text("Token")
                SecureField("sanctum token", text: $token)
                    .textFieldStyle(.roundedBorder)
                Button(isLoading ? "Cargando..." : "Cargar") {
                    Task {
                        await loadManifest()
                    }
                }
                .disabled(isLoading)
            }
            Text("\(routeCode) | \(routeDate)")
                .foregroundStyle(.secondary)
            if let loadError {
                Text(loadError)
                    .foregroundStyle(.red)
            }
            HStack(spacing: 16) {
                Text("Stops: \(totals.stops)")
                Text("Deliveries: \(totals.deliveries)")
                Text("Pickups: \(totals.pickups)")
                Text("Completed: \(totals.completed)")
            }
            Table(rows) {
                TableColumn("Secuencia") { row in
                    Text("\(row.sequence)")
                }
                TableColumn("Tipo") { row in
                    Text(row.stopType)
                }
                TableColumn("Referencia") { row in
                    Text(row.reference)
                }
                TableColumn("Estado") { row in
                    Text(row.status)
                }
            }
        }
        .padding(20)
    }
}
