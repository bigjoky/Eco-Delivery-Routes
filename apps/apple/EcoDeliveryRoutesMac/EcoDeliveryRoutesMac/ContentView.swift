import SharedCore
import SwiftUI

struct ContentView: View {
    private enum Section: String, CaseIterable, Identifiable {
        case dashboard = "Dashboard"
        case operations = "Operativa"
        case quality = "Calidad"
        case network = "Red"
        case account = "Cuenta"

        var id: String { rawValue }
    }

    @EnvironmentObject private var authSession: AuthSession
    let apiClient: APIClientProtocol

    @State private var selectedSection: Section? = .dashboard

    @State private var email = ""
    @State private var password = ""
    @State private var authMessage = "Inicia sesion para usar el panel."
    @State private var authLoading = false

    @State private var me: User?
    @State private var routeDate = Self.todayISODate()
    @State private var routeStops: [DriverStop] = []
    @State private var selectedStopID: String?
    @State private var scanCode = ""
    @State private var podSignature = ""
    @State private var operationsMessage = ""

    @State private var qualityScope = "route"
    @State private var qualityRows: [QualitySnapshot] = []
    @State private var qualityMessage = ""

    @State private var hubs: [HubSummary] = []
    @State private var depots: [DepotSummary] = []
    @State private var points: [PointSummary] = []
    @State private var networkMessage = ""
    @State private var newHubName = ""
    @State private var newHubCity = ""
    @State private var newDepotHubID = ""
    @State private var newDepotName = ""
    @State private var newDepotCity = ""
    @State private var newPointHubID = ""
    @State private var newPointDepotID = ""
    @State private var newPointName = ""
    @State private var newPointCity = ""

    private var selectedStop: DriverStop? {
        routeStops.first(where: { $0.id == selectedStopID }) ?? routeStops.first
    }

    var body: some View {
        Group {
            if authSession.token == nil {
                loginView
            } else {
                mainView
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
                colors: [Color(red: 0.08, green: 0.12, blue: 0.20), Color(red: 0.10, green: 0.24, blue: 0.30)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 14) {
                Text("Eco Delivery Routes")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.white)

                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)

                Button(authLoading ? "Entrando..." : "Entrar") {
                    Task { await login() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(authLoading || email.isEmpty || password.isEmpty)

                Text(authMessage)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.85))
            }
            .padding(22)
            .frame(width: 420)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private var mainView: some View {
        NavigationSplitView {
            List(Section.allCases, selection: $selectedSection) { section in
                Text(section.rawValue)
                    .tag(section)
            }
            .navigationTitle("Eco Delivery")
        } detail: {
            switch selectedSection ?? .dashboard {
            case .dashboard:
                dashboardView
            case .operations:
                operationsView
            case .quality:
                qualityView
            case .network:
                networkView
            case .account:
                accountView
            }
        }
        .toolbar {
            Button("Refrescar") {
                Task { await bootstrap() }
            }
        }
    }

    private var dashboardView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Resumen operativo")
                    .font(.title2.weight(.semibold))
                HStack(spacing: 12) {
                    metricCard(title: "Paradas de ruta", value: "\(routeStops.count)")
                    metricCard(title: "KPI cargados", value: "\(qualityRows.count)")
                    metricCard(title: "Hubs", value: "\(hubs.count)")
                    metricCard(title: "Depots/Puntos", value: "\(depots.count)/\(points.count)")
                }
                if let me {
                    Text("Sesion: \(me.name) · \(me.email)")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(20)
        }
    }

    private var operationsView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Operativa de ruta")
                    .font(.title2.weight(.semibold))

                HStack {
                    TextField("Fecha ruta (YYYY-MM-DD)", text: $routeDate)
                    Button("Cargar ruta") { Task { await loadRoute() } }
                }

                if routeStops.isEmpty {
                    Text("Sin paradas disponibles.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(routeStops) { stop in
                        Button {
                            selectedStopID = stop.id
                        } label: {
                            HStack {
                                Text("#\(stop.sequence) \(stop.reference)")
                                Spacer()
                                Text(stop.status).foregroundStyle(.secondary)
                            }
                            .padding(8)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(selectedStop?.id == stop.id ? Color.teal.opacity(0.2) : Color.gray.opacity(0.08))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                GroupBox("Acciones") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Parada activa: \(selectedStop?.reference ?? "-")")
                            .foregroundStyle(.secondary)
                        HStack {
                            TextField("Codigo scan", text: $scanCode)
                            Button("Registrar scan") { Task { await registerScan() } }
                                .disabled(selectedStop == nil || scanCode.isEmpty)
                        }
                        HStack {
                            TextField("Firma POD", text: $podSignature)
                            Button("Registrar POD") { Task { await registerPod() } }
                                .disabled(selectedStop == nil || podSignature.isEmpty)
                        }
                    }
                    .padding(8)
                }

                if !operationsMessage.isEmpty {
                    Text(operationsMessage).font(.footnote)
                }
            }
            .padding(20)
        }
    }

    private var qualityView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("KPI Calidad")
                    .font(.title2.weight(.semibold))
                Picker("Scope", selection: $qualityScope) {
                    Text("Ruta").tag("route")
                    Text("Conductor").tag("driver")
                    Text("Subcontrata").tag("subcontractor")
                }
                .pickerStyle(.segmented)
                Button("Actualizar KPI") { Task { await loadQuality() } }

                if !qualityMessage.isEmpty {
                    Text(qualityMessage).font(.footnote)
                }

                ForEach(qualityRows) { row in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(row.scopeLabel ?? row.scopeId).font(.headline)
                        Text("Score: \(row.serviceQualityScore, format: .number.precision(.fractionLength(2)))%")
                        ProgressView(value: min(max(row.serviceQualityScore / 100, 0), 1))
                            .tint(row.serviceQualityScore >= 95 ? .green : .orange)
                        Text("Completados: \(row.deliveredCompleted + row.pickupsCompleted)/\(row.assignedWithAttempt)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.gray.opacity(0.08)))
                }
            }
            .padding(20)
        }
    }

    private var networkView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Red operativa")
                    .font(.title2.weight(.semibold))
                Button("Recargar red") { Task { await loadNetwork() } }

                GroupBox("Crear Hub") {
                    VStack(spacing: 8) {
                        TextField("Nombre hub", text: $newHubName)
                        TextField("Ciudad hub", text: $newHubCity)
                        Button("Crear hub") { Task { await createHub() } }
                            .disabled(newHubName.isEmpty)
                    }
                    .padding(8)
                }

                GroupBox("Crear Depot") {
                    VStack(spacing: 8) {
                        TextField("Hub ID", text: $newDepotHubID)
                        TextField("Nombre depot", text: $newDepotName)
                        TextField("Ciudad depot", text: $newDepotCity)
                        Button("Crear depot") { Task { await createDepot() } }
                            .disabled(newDepotHubID.isEmpty || newDepotName.isEmpty)
                    }
                    .padding(8)
                }

                GroupBox("Crear Punto") {
                    VStack(spacing: 8) {
                        TextField("Hub ID", text: $newPointHubID)
                        TextField("Depot ID (opcional)", text: $newPointDepotID)
                        TextField("Nombre punto", text: $newPointName)
                        TextField("Ciudad punto", text: $newPointCity)
                        Button("Crear punto") { Task { await createPoint() } }
                            .disabled(newPointHubID.isEmpty || newPointName.isEmpty)
                    }
                    .padding(8)
                }

                Text("Hubs: \(hubs.count) · Depots: \(depots.count) · Puntos: \(points.count)")
                    .font(.subheadline)
                if !networkMessage.isEmpty {
                    Text(networkMessage).font(.footnote)
                }
            }
            .padding(20)
        }
    }

    private var accountView: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Cuenta")
                .font(.title2.weight(.semibold))
            Text(me?.name ?? "Sin usuario")
            Text(me?.email ?? "-")
                .foregroundStyle(.secondary)
            if let roles = me?.roles, !roles.isEmpty {
                Text("Roles: \(roles.map(\.code).joined(separator: ", "))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Button("Cerrar sesion", role: .destructive) {
                Task { await logout() }
            }
            Spacer()
        }
        .padding(20)
    }

    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            Text(value).font(.title2.weight(.semibold))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.gray.opacity(0.10)))
    }

    private func bootstrap() async {
        await loadProfile()
        await loadRoute()
        await loadQuality()
        await loadNetwork()
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
        routeStops = []
        qualityRows = []
        hubs = []
        depots = []
        points = []
    }

    private func loadProfile() async {
        do {
            me = try await apiClient.me()
        } catch {
            operationsMessage = "No se pudo cargar perfil."
        }
    }

    private func loadRoute() async {
        do {
            let payload = try await apiClient.myRoute(routeDate: routeDate, status: nil)
            routeStops = payload.stops
            selectedStopID = routeStops.first?.id
            operationsMessage = "Ruta cargada."
        } catch {
            operationsMessage = "No se pudo cargar la ruta."
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

    private func loadNetwork() async {
        do {
            async let hubsResult = apiClient.hubs(onlyActive: true, includeDeleted: false)
            async let depotsResult = apiClient.depots(hubId: nil, includeDeleted: false)
            async let pointsResult = apiClient.points(hubId: nil, depotId: nil, includeDeleted: false)
            hubs = try await hubsResult
            depots = try await depotsResult
            points = try await pointsResult
            networkMessage = "Red actualizada."
        } catch {
            hubs = []
            depots = []
            points = []
            networkMessage = "No se pudo cargar red."
        }
    }

    private func registerScan() async {
        guard let stop = selectedStop else { return }
        do {
            try await apiClient.registerScan(trackableType: stop.entityType, trackableId: stop.entityId, scanCode: scanCode)
            operationsMessage = "Scan registrado."
            scanCode = ""
        } catch {
            operationsMessage = "Error registrando scan."
        }
    }

    private func registerPod() async {
        guard let stop = selectedStop else { return }
        do {
            try await apiClient.registerPod(evidenceType: stop.entityType, evidenceId: stop.entityId, signatureName: podSignature)
            operationsMessage = "POD registrado."
            podSignature = ""
        } catch {
            operationsMessage = "Error registrando POD."
        }
    }

    private func createHub() async {
        do {
            _ = try await apiClient.createHub(name: newHubName, city: newHubCity)
            newHubName = ""
            newHubCity = ""
            await loadNetwork()
        } catch {
            networkMessage = "No se pudo crear hub."
        }
    }

    private func createDepot() async {
        do {
            _ = try await apiClient.createDepot(hubId: newDepotHubID, name: newDepotName, city: newDepotCity)
            newDepotName = ""
            newDepotCity = ""
            await loadNetwork()
        } catch {
            networkMessage = "No se pudo crear depot."
        }
    }

    private func createPoint() async {
        do {
            let depotID = newPointDepotID.isEmpty ? nil : newPointDepotID
            _ = try await apiClient.createPoint(hubId: newPointHubID, depotId: depotID, name: newPointName, city: newPointCity)
            newPointName = ""
            newPointCity = ""
            await loadNetwork()
        } catch {
            networkMessage = "No se pudo crear punto."
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
