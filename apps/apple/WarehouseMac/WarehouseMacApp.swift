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

struct WarehouseManifestView: View {
    private let routeCode = "R-AGP-20260228"
    private let routeDate = "2026-02-28"
    @State private var rows: [WarehouseManifestRow] = [
        .init(id: "st-1", sequence: 1, stopType: "DELIVERY", reference: "SHP-AGP-0001", status: "planned"),
        .init(id: "st-2", sequence: 2, stopType: "PICKUP", reference: "PCK-AGP-0001", status: "planned"),
        .init(id: "st-3", sequence: 3, stopType: "DELIVERY", reference: "SHP-AGP-0002", status: "completed")
    ]

    private var deliveries: Int { rows.filter { $0.stopType == "DELIVERY" }.count }
    private var pickups: Int { rows.filter { $0.stopType == "PICKUP" }.count }
    private var completed: Int { rows.filter { $0.status == "completed" }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Manifest de Ruta")
                .font(.title2)
                .bold()
            Text("\(routeCode) | \(routeDate)")
                .foregroundStyle(.secondary)
            HStack(spacing: 16) {
                Text("Stops: \(rows.count)")
                Text("Deliveries: \(deliveries)")
                Text("Pickups: \(pickups)")
                Text("Completed: \(completed)")
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
