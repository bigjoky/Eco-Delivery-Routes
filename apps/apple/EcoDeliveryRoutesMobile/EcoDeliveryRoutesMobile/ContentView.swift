import SharedCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var authSession: AuthSession
    let apiClient: APIClientProtocol

    @State private var email = ""
    @State private var password = ""
    @State private var authMessage = "Inicia sesion para comenzar."
    @State private var authLoading = false

    @State private var me: User?
    @State private var routeDate = Self.todayISODate()
    @State private var routeStatus = ""
    @State private var routeStops: [DriverStop] = []
    @State private var selectedStopID: String?
    @State private var scanCode = ""
    @State private var podSignature = ""
    @State private var incidentCode = "ABSENT_HOME"
    @State private var incidentCategory = "delivery"
    @State private var incidentNotes = ""
    @State private var routeMessage = ""

    @State private var pickupHubID = ""
    @State private var pickupReference = ""
    @State private var pickupType = "NORMAL"
    @State private var pickupMessage = ""
    @State private var shipmentHubID = ""
    @State private var consigneeName = ""
    @State private var consigneeDocument = ""
    @State private var consigneePhone = ""
    @State private var senderName = ""
    @State private var senderDocument = ""
    @State private var senderPhone = ""
    @State private var serviceType = "express_1030"
    @State private var shipmentMessage = ""

    @State private var qualityScope = "driver"
    @State private var qualityRows: [QualitySnapshot] = []
    @State private var qualityMessage = ""
    @State private var hubsCount = 0
    @State private var depotsCount = 0
    @State private var pointsCount = 0

    private let serviceTypes = [
        "express_1030",
        "express_1400",
        "express_1900",
        "economy_parcel",
        "business_parcel",
        "thermo_parcel",
    ]

    private var selectedStop: DriverStop? {
        routeStops.first(where: { $0.id == selectedStopID }) ?? routeStops.first
    }

    var body: some View {
        Group {
            if authSession.token == nil {
                loginView
            } else {
                appView
            }
        }
        .task(id: authSession.token?.token) {
            apiClient.setAuthToken(authSession.token?.token)
            guard authSession.token != nil else { return }
            await bootstrap()
        }
    }

    private var loginView: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.07, green: 0.13, blue: 0.20), Color(red: 0.11, green: 0.27, blue: 0.30)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                Text("Eco Delivery Routes")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                    Button(authLoading ? "Entrando..." : "Entrar") {
                        Task { await login() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(authLoading || email.isEmpty || password.isEmpty)
                }

                Text(authMessage)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.85))
            }
            .padding(20)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            .padding(.horizontal, 24)
        }
    }

    private var appView: some View {
        TabView {
            NavigationStack { routeTab }
                .tabItem { Label("Ruta", systemImage: "map") }
            NavigationStack { pickupsAndShipmentsTab }
                .tabItem { Label("Operaciones", systemImage: "shippingbox") }
            NavigationStack { qualityTab }
                .tabItem { Label("Calidad", systemImage: "chart.line.uptrend.xyaxis") }
            NavigationStack { accountTab }
                .tabItem { Label("Cuenta", systemImage: "person.circle") }
        }
        .tint(.teal)
    }

    private var routeTab: some View {
        List {
            Section("Filtro de ruta") {
                TextField("Fecha (YYYY-MM-DD)", text: $routeDate)
                TextField("Estado (opcional)", text: $routeStatus)
                Button("Recargar ruta") { Task { await loadRoute() } }
            }

            Section("Paradas (\(routeStops.count))") {
                if routeStops.isEmpty {
                    Text("Sin paradas para el filtro actual.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(routeStops) { stop in
                        Button {
                            selectedStopID = stop.id
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("#\(stop.sequence) · \(stop.reference)")
                                        .font(.subheadline.weight(.semibold))
                                    Text("\(stop.stopType) · \(stop.status)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if selectedStop?.id == stop.id {
                                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.teal)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Section("Acciones sobre parada activa") {
                Text("Parada: \(selectedStop?.reference ?? "-")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Codigo de scan", text: $scanCode)
                Button("Registrar scan") { Task { await submitScan() } }
                    .disabled(selectedStop == nil || scanCode.isEmpty)

                TextField("Nombre para POD", text: $podSignature)
                Button("Registrar POD") { Task { await submitPod() } }
                    .disabled(selectedStop == nil || podSignature.isEmpty)

                TextField("Codigo incidencia", text: $incidentCode)
                TextField("Categoria incidencia", text: $incidentCategory)
                TextField("Notas incidencia", text: $incidentNotes, axis: .vertical)
                Button("Registrar incidencia") { Task { await submitIncident() } }
                    .disabled(selectedStop == nil || incidentCode.isEmpty || incidentCategory.isEmpty)
            }

            if !routeMessage.isEmpty {
                Section {
                    Text(routeMessage).font(.footnote)
                }
            }
        }
        .navigationTitle("Ruta del conductor")
    }

    private var pickupsAndShipmentsTab: some View {
        List {
            Section("Nueva recogida") {
                TextField("Hub ID", text: $pickupHubID)
                TextField("Referencia recogida", text: $pickupReference)
                Picker("Tipo", selection: $pickupType) {
                    Text("NORMAL").tag("NORMAL")
                    Text("RETURN").tag("RETURN")
                }
                .pickerStyle(.segmented)

                Button("Crear recogida") { Task { await createPickup() } }
                    .disabled(pickupHubID.isEmpty || pickupReference.isEmpty)
            }

            if !pickupMessage.isEmpty {
                Section {
                    Text(pickupMessage).font(.footnote)
                }
            }

            Section("Nuevo envio") {
                TextField("Hub ID", text: $shipmentHubID)
                TextField("Destinatario nombre", text: $consigneeName)
                TextField("Destinatario documento", text: $consigneeDocument)
                TextField("Destinatario telefono", text: $consigneePhone)
                TextField("Remitente nombre", text: $senderName)
                TextField("Remitente documento", text: $senderDocument)
                TextField("Remitente telefono", text: $senderPhone)
                Picker("Servicio", selection: $serviceType) {
                    ForEach(serviceTypes, id: \.self) { type in
                        Text(type).tag(type)
                    }
                }
                Button("Crear envio") { Task { await createShipment() } }
                    .disabled(
                        shipmentHubID.isEmpty ||
                        consigneeName.isEmpty ||
                        consigneeDocument.isEmpty ||
                        consigneePhone.isEmpty ||
                        senderName.isEmpty ||
                        senderDocument.isEmpty ||
                        senderPhone.isEmpty
                    )
            }

            if !shipmentMessage.isEmpty {
                Section {
                    Text(shipmentMessage).font(.footnote)
                }
            }
        }
        .navigationTitle("Operaciones")
    }

    private var qualityTab: some View {
        List {
            Section("Indicadores de calidad") {
                Picker("Scope", selection: $qualityScope) {
                    Text("Conductor").tag("driver")
                    Text("Ruta").tag("route")
                    Text("Subcontrata").tag("subcontractor")
                }
                .pickerStyle(.segmented)

                Button("Actualizar KPI") { Task { await loadQuality() } }
            }

            if !qualityMessage.isEmpty {
                Section {
                    Text(qualityMessage).font(.footnote)
                }
            }

            Section("KPI (\(qualityRows.count))") {
                ForEach(qualityRows) { row in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(row.scopeLabel ?? row.scopeId)
                            .font(.headline)
                        Text("Score: \(row.serviceQualityScore, format: .number.precision(.fractionLength(2)))%")
                            .font(.subheadline)
                        Text("Completados: \(row.deliveredCompleted + row.pickupsCompleted) / \(row.assignedWithAttempt)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ProgressView(value: min(max(row.serviceQualityScore / 100, 0), 1))
                            .tint(row.serviceQualityScore >= 95 ? .green : .orange)
                    }
                }
            }

            Section("Red operativa") {
                Text("Hubs: \(hubsCount)")
                Text("Depots: \(depotsCount)")
                Text("Puntos: \(pointsCount)")
                Button("Actualizar red") { Task { await loadNetworkCounts() } }
            }
        }
        .navigationTitle("KPI Calidad")
    }

    private var accountTab: some View {
        List {
            Section("Perfil") {
                Text(me?.name ?? "Sin perfil")
                Text(me?.email ?? "-").foregroundStyle(.secondary)
                Text("Estado: \(me?.status ?? "-")")
            }
            Section("Roles") {
                if me?.roles.isEmpty ?? true {
                    Text("Sin roles")
                } else {
                    ForEach(me?.roles ?? [], id: \.id) { role in
                        Text(role.name)
                    }
                }
            }
            Section {
                Button("Cerrar sesion", role: .destructive) {
                    Task { await logout() }
                }
            }
        }
        .navigationTitle("Cuenta")
    }

    private func bootstrap() async {
        await loadProfile()
        await loadRoute()
        await loadQuality()
        await loadNetworkCounts()
    }

    private func login() async {
        authLoading = true
        defer { authLoading = false }
        do {
            let token = try await apiClient.login(email: email, password: password)
            authSession.updateToken(token)
            authMessage = "Sesion iniciada."
        } catch {
            authMessage = "No se pudo iniciar sesion."
        }
    }

    private func logout() async {
        await apiClient.logout()
        authSession.updateToken(nil)
        me = nil
        routeStops = []
        qualityRows = []
    }

    private func loadProfile() async {
        do {
            me = try await apiClient.me()
        } catch {
            routeMessage = "No se pudo cargar perfil."
        }
    }

    private func loadRoute() async {
        do {
            let payload = try await apiClient.myRoute(routeDate: routeDate, status: routeStatus.isEmpty ? nil : routeStatus)
            routeStops = payload.stops
            selectedStopID = payload.stops.first?.id
            routeMessage = "Ruta cargada (\(payload.stops.count) paradas)."
        } catch {
            routeMessage = "No se pudo cargar la ruta."
        }
    }

    private func loadQuality() async {
        do {
            qualityRows = try await apiClient.qualitySnapshots(scopeType: qualityScope)
            qualityMessage = "KPI actualizado."
        } catch {
            qualityRows = []
            qualityMessage = "No se pudo cargar KPI."
        }
    }

    private func loadNetworkCounts() async {
        do {
            async let hubs = apiClient.hubs(onlyActive: true, includeDeleted: false)
            async let depots = apiClient.depots(hubId: nil, includeDeleted: false)
            async let points = apiClient.points(hubId: nil, depotId: nil, includeDeleted: false)
            hubsCount = try await hubs.count
            depotsCount = try await depots.count
            pointsCount = try await points.count
        } catch {
            hubsCount = 0
            depotsCount = 0
            pointsCount = 0
        }
    }

    private func submitScan() async {
        guard let stop = selectedStop else { return }
        do {
            try await apiClient.registerScan(trackableType: stop.entityType, trackableId: stop.entityId, scanCode: scanCode)
            routeMessage = "Scan registrado correctamente."
            scanCode = ""
        } catch {
            routeMessage = "No se pudo registrar scan."
        }
    }

    private func submitPod() async {
        guard let stop = selectedStop else { return }
        do {
            try await apiClient.registerPod(evidenceType: stop.entityType, evidenceId: stop.entityId, signatureName: podSignature)
            routeMessage = "POD registrado."
            podSignature = ""
        } catch {
            routeMessage = "No se pudo registrar POD."
        }
    }

    private func submitIncident() async {
        guard let stop = selectedStop else { return }
        do {
            try await apiClient.registerIncident(
                incidentableType: stop.entityType,
                incidentableId: stop.entityId,
                catalogCode: incidentCode,
                category: incidentCategory,
                notes: incidentNotes
            )
            routeMessage = "Incidencia registrada."
            incidentNotes = ""
        } catch {
            routeMessage = "No se pudo registrar incidencia."
        }
    }

    private func createPickup() async {
        do {
            try await apiClient.createPickup(reference: pickupReference, pickupType: pickupType, hubId: pickupHubID)
            pickupMessage = "Recogida creada."
            pickupReference = ""
        } catch {
            pickupMessage = "No se pudo crear recogida."
        }
    }

    private func createShipment() async {
        do {
            try await apiClient.createShipment(
                hubId: shipmentHubID,
                consigneeName: consigneeName,
                consigneeDocumentId: consigneeDocument,
                consigneePhone: consigneePhone,
                senderName: senderName,
                senderDocumentId: senderDocument,
                senderPhone: senderPhone,
                scheduledAt: routeDate,
                serviceType: serviceType
            )
            shipmentMessage = "Envio creado."
            consigneeName = ""
            consigneeDocument = ""
            consigneePhone = ""
            senderName = ""
            senderDocument = ""
            senderPhone = ""
        } catch {
            shipmentMessage = "No se pudo crear envio."
        }
    }

    private static func todayISODate() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

#Preview {
    ContentView(apiClient: APIClient(baseURL: nil))
        .environmentObject(AuthSession())
}
