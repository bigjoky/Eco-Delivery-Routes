import SharedCore
import SwiftUI
import Foundation

struct ContentView: View {
    @EnvironmentObject private var authSession: AuthSession
    let apiClient: APIClientProtocol

    @State private var email: String = "admin@eco.local"
    @State private var password: String = "password123"
    @State private var loginMessage: String = "No autenticado"

    @State private var routeStops: [DriverStop] = []
    @State private var selectedStopId: String?
    @State private var routeDateFilter: String = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }()
    @State private var routeStatusFilter: String = ""
    @State private var routeQuality: [QualitySnapshot] = []
    @State private var scanCode: String = ""
    @State private var podSignature: String = ""
    @State private var pickupReference: String = "PCK-"
    @State private var incidentCode: String = "ABSENT_HOME"
    @State private var incidentNotes: String = ""
    @State private var driverMessage: String = ""

    var body: some View {
        Group {
            if authSession.token == nil {
                loginView
            } else {
                driverView
            }
        }
        .task(id: authSession.token?.token) {
            apiClient.setAuthToken(authSession.token?.token)
            guard authSession.token != nil else { return }
            await loadRoute()
            await loadRouteQuality()
        }
    }

    private var selectedStop: DriverStop? {
        routeStops.first(where: { $0.id == selectedStopId }) ?? routeStops.first
    }

    private var loginView: some View {
        VStack(spacing: 12) {
            Text("Driver Login")
                .font(.headline)

            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            Button("Entrar") {
                Task { await login() }
            }
            .disabled(email.isEmpty || password.isEmpty)

            Text(loginMessage)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    private var driverView: some View {
        NavigationStack {
            List {
                Section("Mi ruta") {
                    TextField("Fecha ruta (YYYY-MM-DD)", text: $routeDateFilter)
                    TextField("Estado ruta (opcional)", text: $routeStatusFilter)
                    Button("Cargar ruta del dia") {
                        Task { await loadRoute() }
                    }
                    ForEach(routeStops) { stop in
                        Button {
                            selectedStopId = stop.id
                        } label: {
                            VStack(alignment: .leading) {
                                Text("\(selectedStop?.id == stop.id ? "[*]" : "[ ]") #\(stop.sequence) \(stop.stopType)")
                                Text("\(stop.reference) · \(stop.status)")
                                    .font(.caption)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    Text("Parada activa: \(selectedStop?.reference ?? "-")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("KPI calidad por ruta") {
                    ForEach(routeQuality) { snapshot in
                        VStack(alignment: .leading) {
                            Text(snapshot.scopeLabel ?? snapshot.scopeId)
                            Text("\(snapshot.serviceQualityScore, specifier: "%.2f")% · \(snapshot.periodStart) - \(snapshot.periodEnd)")
                                .font(.caption)
                            Text("Completados: \(snapshot.deliveredCompleted + snapshot.pickupsCompleted)/\(snapshot.assignedWithAttempt)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Button("Refrescar KPI") {
                        Task { await loadRouteQuality() }
                    }
                }

                Section("Scan") {
                    TextField("Codigo escaneado", text: $scanCode)
                    Button("Registrar scan") {
                        Task {
                            guard let target = selectedStop else { return }
                            do {
                                try await apiClient.registerScan(trackableType: target.entityType, trackableId: target.entityId, scanCode: scanCode)
                                driverMessage = "Scan registrado"
                                updateSelectedStopStatus("in_progress")
                            } catch {
                                driverMessage = "Error scan"
                            }
                        }
                    }
                }

                Section("POD") {
                    TextField("Nombre firma", text: $podSignature)
                    Button("Registrar POD") {
                        Task {
                            guard let target = selectedStop else { return }
                            do {
                                try await apiClient.registerPod(evidenceType: target.entityType, evidenceId: target.entityId, signatureName: podSignature)
                                driverMessage = "POD registrado"
                                updateSelectedStopStatus("completed")
                            } catch {
                                driverMessage = "Error POD"
                            }
                        }
                    }
                }

                Section("Recogidas") {
                    TextField("Referencia pickup", text: $pickupReference)
                    HStack {
                        Button("Pickup NORMAL") {
                            Task { await createPickup(type: "NORMAL") }
                        }
                        Button("Pickup RETURN") {
                            Task { await createPickup(type: "RETURN") }
                        }
                    }
                }

                Section("Incidencias") {
                    TextField("Codigo incidencia", text: $incidentCode)
                    TextField("Notas incidencia", text: $incidentNotes)
                    Button("Registrar incidencia") {
                        Task {
                            guard let target = selectedStop else { return }
                            do {
                                try await apiClient.registerIncident(
                                    incidentableType: target.entityType,
                                    incidentableId: target.entityId,
                                    catalogCode: incidentCode,
                                    category: "absent",
                                    notes: incidentNotes
                                )
                                driverMessage = "Incidencia registrada"
                                updateSelectedStopStatus("incident")
                            } catch {
                                driverMessage = "Error incidencia"
                            }
                        }
                    }
                }

                Section("Sesion") {
                    Button("Cerrar sesion") {
                        authSession.updateToken(nil)
                        apiClient.setAuthToken(nil)
                        routeStops = []
                        selectedStopId = nil
                        routeQuality = []
                        loginMessage = "No autenticado"
                    }
                }
            }
            .navigationTitle("Driver App")
            .overlay(alignment: .bottom) {
                if !driverMessage.isEmpty {
                    Text(driverMessage)
                        .font(.caption)
                        .padding(8)
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding()
                }
            }
        }
    }

    private func login() async {
        do {
            let token = try await apiClient.login(email: email, password: password)
            authSession.updateToken(token)
            apiClient.setAuthToken(token.token)
            loginMessage = "Sesion activa"
            await loadRoute()
            await loadRouteQuality()
        } catch {
            loginMessage = "Error de login"
        }
    }

    private func loadRoute() async {
        let payload = (try? await apiClient.myRoute(
            routeDate: routeDateFilter.isEmpty ? nil : routeDateFilter,
            status: routeStatusFilter.isEmpty ? nil : routeStatusFilter
        ))
        routeStops = payload?.stops ?? []
        selectedStopId = routeStops.first?.id
    }

    private func loadRouteQuality() async {
        routeQuality = (try? await apiClient.qualitySnapshots(scopeType: "route")) ?? []
    }

    private func createPickup(type: String) async {
        do {
            try await apiClient.createPickup(
                reference: pickupReference,
                pickupType: type,
                hubId: "00000000-0000-0000-0000-000000000001"
            )
            driverMessage = "Pickup \(type) creado"
        } catch {
            driverMessage = "Error pickup \(type)"
        }
    }

    private func updateSelectedStopStatus(_ status: String) {
        guard let selectedStopId else { return }
        routeStops = routeStops.map { stop in
            if stop.id == selectedStopId {
                return DriverStop(
                    id: stop.id,
                    sequence: stop.sequence,
                    stopType: stop.stopType,
                    entityType: stop.entityType,
                    entityId: stop.entityId,
                    reference: stop.reference,
                    status: status
                )
            }
            return stop
        }
    }
}

#Preview {
    ContentView(apiClient: APIClient(baseURL: nil))
}
