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
    @AppStorage("driver_route_date_filter") private var routeDateFilter: String = ""
    @AppStorage("driver_route_status_filter") private var routeStatusFilter: String = ""
    @State private var routeQuality: [QualitySnapshot] = []
    @State private var scanCode: String = ""
    @State private var podSignature: String = ""
    @AppStorage("driver_pickup_reference") private var pickupReference: String = "PCK-"
    @AppStorage("driver_incident_code") private var incidentCode: String = "ABSENT_HOME"
    @State private var incidentNotes: String = ""
    @State private var driverMessage: String = ""
    @State private var draftRecipientDocType: String = "DNI"
    @State private var draftRecipientDocument: String = ""
    @State private var draftRecipientFirstName: String = ""
    @State private var draftRecipientLastName: String = ""
    @State private var draftRecipientLegalName: String = ""
    @State private var draftRecipientPhone: String = ""
    @State private var draftSenderDocType: String = "DNI"
    @State private var draftSenderDocument: String = ""
    @State private var draftSenderFirstName: String = ""
    @State private var draftSenderLastName: String = ""
    @State private var draftSenderLegalName: String = ""
    @State private var draftSenderPhone: String = ""
    @State private var draftShipmentMessage: String = ""
    @State private var hubs: [HubSummary] = []
    @State private var depots: [DepotSummary] = []
    @State private var points: [PointSummary] = []
    @State private var networkIncludeDeleted = false
    @State private var networkMessage = ""
    @State private var roleCodes: [String] = []
    @State private var newHubName: String = ""
    @State private var newHubCity: String = ""
    @State private var editHubId: String = ""
    @State private var editHubName: String = ""
    @State private var editHubCity: String = ""
    @State private var newDepotHubId: String = ""
    @State private var newDepotName: String = ""
    @State private var newDepotCity: String = ""
    @State private var editDepotId: String = ""
    @State private var editDepotName: String = ""
    @State private var editDepotCity: String = ""
    @State private var newPointHubId: String = ""
    @State private var newPointDepotId: String = ""
    @State private var newPointName: String = ""
    @State private var newPointCity: String = ""
    @State private var editPointId: String = ""
    @State private var editPointName: String = ""
    @State private var editPointCity: String = ""

    private var canAccessNetwork: Bool {
        let allowed = Set(["super_admin", "operations_manager", "warehouse_manager", "traffic_manager"])
        return !Set(roleCodes).isDisjoint(with: allowed)
    }

    var body: some View {
        Group {
            if authSession.token == nil {
                loginView
            } else {
                TabView {
                    driverView
                        .tabItem {
                            Label("Ruta", systemImage: "map")
                        }
                    shipmentDraftView
                        .tabItem {
                            Label("Nuevo envío", systemImage: "shippingbox")
                        }
                    if canAccessNetwork {
                        networkView
                            .tabItem {
                                Label("Red", systemImage: "point.3.connected.trianglepath.dotted")
                            }
                    }
                }
            }
        }
        .task(id: authSession.token?.token) {
            apiClient.setAuthToken(authSession.token?.token)
            guard authSession.token != nil else { return }
            if routeDateFilter.isEmpty {
                routeDateFilter = currentISODate()
            }
            await loadAuthProfile()
            await loadRoute()
            await loadRouteQuality()
            if canAccessNetwork {
                await loadNetworkNodes()
            }
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
                        Task {
                            guard isValidRouteDate(routeDateFilter) else {
                                driverMessage = "Fecha invalida. Usa YYYY-MM-DD."
                                return
                            }
                            await loadRoute()
                        }
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
                            let normalizedCode = incidentCode.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !normalizedCode.isEmpty else {
                                driverMessage = "Codigo incidencia obligatorio."
                                return
                            }
                            do {
                                try await apiClient.registerIncident(
                                    incidentableType: target.entityType,
                                    incidentableId: target.entityId,
                                    catalogCode: normalizedCode,
                                    category: incidentCategory(for: normalizedCode),
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
                        Task {
                            await apiClient.logout()
                            authSession.updateToken(nil)
                            apiClient.setAuthToken(nil)
                            routeStops = []
                            selectedStopId = nil
                            routeQuality = []
                            loginMessage = "No autenticado"
                        }
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

    private var networkView: some View {
        NavigationStack {
            List {
                Section("Configuracion") {
                    Toggle("Mostrar archivados", isOn: $networkIncludeDeleted)
                        .onChange(of: networkIncludeDeleted) { _, _ in
                            Task { await loadNetworkNodes() }
                        }
                    Button("Recargar red") {
                        Task { await loadNetworkNodes() }
                    }
                    if !networkMessage.isEmpty {
                        Text(networkMessage)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Crear Hub") {
                    TextField("Nombre", text: $newHubName)
                    TextField("Ciudad", text: $newHubCity)
                    Button("Crear hub") {
                        Task {
                            do {
                                _ = try await apiClient.createHub(name: newHubName, city: newHubCity)
                                networkMessage = "Hub creado"
                                newHubName = ""
                                newHubCity = ""
                                await loadNetworkNodes()
                            } catch {
                                networkMessage = "Error creando hub"
                            }
                        }
                    }
                    .disabled(newHubName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || newHubCity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                Section("Hubs") {
                    ForEach(hubs) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(item.code) · \(item.name)")
                            Text(item.city ?? "-")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if item.deletedAt == nil {
                                Button("Editar") {
                                    editHubId = item.id
                                    editHubName = item.name
                                    editHubCity = item.city ?? ""
                                }
                                Button("Archivar") {
                                    Task {
                                        do {
                                            try await apiClient.archiveHub(id: item.id)
                                            networkMessage = "Hub archivado"
                                            await loadNetworkNodes()
                                        } catch {
                                            networkMessage = "Error archivando hub"
                                        }
                                    }
                                }
                            } else {
                                Button("Restaurar") {
                                    Task {
                                        do {
                                            _ = try await apiClient.restoreHub(id: item.id)
                                            networkMessage = "Hub restaurado"
                                            await loadNetworkNodes()
                                        } catch {
                                            networkMessage = "Error restaurando hub"
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if !editHubId.isEmpty {
                        TextField("Nombre", text: $editHubName)
                        TextField("Ciudad", text: $editHubCity)
                        Button("Guardar hub") {
                            Task {
                                do {
                                    _ = try await apiClient.updateHub(
                                        id: editHubId,
                                        name: editHubName,
                                        city: editHubCity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : editHubCity
                                    )
                                    networkMessage = "Hub actualizado"
                                    editHubId = ""
                                    await loadNetworkNodes()
                                } catch {
                                    networkMessage = "Error actualizando hub"
                                }
                            }
                        }
                        Button("Cancelar edición hub") { editHubId = "" }
                    }
                }

                Section("Crear Depot") {
                    TextField("Hub ID", text: $newDepotHubId)
                    TextField("Nombre", text: $newDepotName)
                    TextField("Ciudad (opcional)", text: $newDepotCity)
                    Button("Crear depot") {
                        Task {
                            do {
                                _ = try await apiClient.createDepot(
                                    hubId: newDepotHubId,
                                    name: newDepotName,
                                    city: newDepotCity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : newDepotCity
                                )
                                networkMessage = "Depot creado"
                                newDepotName = ""
                                newDepotCity = ""
                                await loadNetworkNodes()
                            } catch {
                                networkMessage = "Error creando depot"
                            }
                        }
                    }
                    .disabled(newDepotHubId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || newDepotName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                Section("Depots") {
                    ForEach(depots) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(item.code) · \(item.name)")
                            Text("Hub \(item.hubId) · \(item.city ?? "-")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if item.deletedAt == nil {
                                Button("Editar") {
                                    editDepotId = item.id
                                    editDepotName = item.name
                                    editDepotCity = item.city ?? ""
                                }
                                Button("Archivar") {
                                    Task {
                                        do {
                                            try await apiClient.archiveDepot(id: item.id)
                                            networkMessage = "Depot archivado"
                                            await loadNetworkNodes()
                                        } catch {
                                            networkMessage = "Error archivando depot"
                                        }
                                    }
                                }
                            } else {
                                Button("Restaurar") {
                                    Task {
                                        do {
                                            _ = try await apiClient.restoreDepot(id: item.id)
                                            networkMessage = "Depot restaurado"
                                            await loadNetworkNodes()
                                        } catch {
                                            networkMessage = "Error restaurando depot"
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if !editDepotId.isEmpty {
                        TextField("Nombre", text: $editDepotName)
                        TextField("Ciudad", text: $editDepotCity)
                        Button("Guardar depot") {
                            Task {
                                do {
                                    _ = try await apiClient.updateDepot(
                                        id: editDepotId,
                                        name: editDepotName,
                                        city: editDepotCity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : editDepotCity
                                    )
                                    networkMessage = "Depot actualizado"
                                    editDepotId = ""
                                    await loadNetworkNodes()
                                } catch {
                                    networkMessage = "Error actualizando depot"
                                }
                            }
                        }
                        Button("Cancelar edición depot") { editDepotId = "" }
                    }
                }

                Section("Crear Punto") {
                    TextField("Hub ID", text: $newPointHubId)
                    TextField("Depot ID (opcional)", text: $newPointDepotId)
                    TextField("Nombre", text: $newPointName)
                    TextField("Ciudad (opcional)", text: $newPointCity)
                    Button("Crear punto") {
                        Task {
                            do {
                                _ = try await apiClient.createPoint(
                                    hubId: newPointHubId,
                                    depotId: newPointDepotId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : newPointDepotId,
                                    name: newPointName,
                                    city: newPointCity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : newPointCity
                                )
                                networkMessage = "Punto creado"
                                newPointName = ""
                                newPointCity = ""
                                newPointDepotId = ""
                                await loadNetworkNodes()
                            } catch {
                                networkMessage = "Error creando punto"
                            }
                        }
                    }
                    .disabled(newPointHubId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || newPointName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                Section("Puntos") {
                    ForEach(points) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(item.code) · \(item.name)")
                            Text("Hub \(item.hubId) · Depot \(item.depotId ?? "-") · \(item.city ?? "-")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if item.deletedAt == nil {
                                Button("Editar") {
                                    editPointId = item.id
                                    editPointName = item.name
                                    editPointCity = item.city ?? ""
                                }
                                Button("Archivar") {
                                    Task {
                                        do {
                                            try await apiClient.archivePoint(id: item.id)
                                            networkMessage = "Punto archivado"
                                            await loadNetworkNodes()
                                        } catch {
                                            networkMessage = "Error archivando punto"
                                        }
                                    }
                                }
                            } else {
                                Button("Restaurar") {
                                    Task {
                                        do {
                                            _ = try await apiClient.restorePoint(id: item.id)
                                            networkMessage = "Punto restaurado"
                                            await loadNetworkNodes()
                                        } catch {
                                            networkMessage = "Error restaurando punto"
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if !editPointId.isEmpty {
                        TextField("Nombre", text: $editPointName)
                        TextField("Ciudad", text: $editPointCity)
                        Button("Guardar punto") {
                            Task {
                                do {
                                    _ = try await apiClient.updatePoint(
                                        id: editPointId,
                                        name: editPointName,
                                        city: editPointCity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : editPointCity
                                    )
                                    networkMessage = "Punto actualizado"
                                    editPointId = ""
                                    await loadNetworkNodes()
                                } catch {
                                    networkMessage = "Error actualizando punto"
                                }
                            }
                        }
                        Button("Cancelar edición punto") { editPointId = "" }
                    }
                }
            }
            .navigationTitle("Red Operativa")
        }
    }

    private var shipmentDraftView: some View {
        NavigationStack {
            Form {
                Section("Destinatario") {
                    Picker("Tipo documento", selection: $draftRecipientDocType) {
                        Text("DNI").tag("DNI")
                        Text("NIE").tag("NIE")
                        Text("PASSPORT").tag("PASSPORT")
                        Text("CIF").tag("CIF")
                    }
                    .pickerStyle(.segmented)
                    TextField("Documento", text: $draftRecipientDocument)
                        .onChange(of: draftRecipientDocument) { _, value in
                            draftRecipientDocType = inferDocumentType(value, fallback: draftRecipientDocType)
                        }
                    if draftRecipientDocType == "CIF" {
                        TextField("Razon social", text: $draftRecipientLegalName)
                    } else {
                        TextField("Nombre", text: $draftRecipientFirstName)
                        TextField("Apellidos", text: $draftRecipientLastName)
                    }
                    TextField("Telefono", text: $draftRecipientPhone)
                }

                Section("Remitente") {
                    Picker("Tipo documento", selection: $draftSenderDocType) {
                        Text("DNI").tag("DNI")
                        Text("NIE").tag("NIE")
                        Text("PASSPORT").tag("PASSPORT")
                        Text("CIF").tag("CIF")
                    }
                    .pickerStyle(.segmented)
                    TextField("Documento", text: $draftSenderDocument)
                        .onChange(of: draftSenderDocument) { _, value in
                            draftSenderDocType = inferDocumentType(value, fallback: draftSenderDocType)
                        }
                    if draftSenderDocType == "CIF" {
                        TextField("Razon social", text: $draftSenderLegalName)
                    } else {
                        TextField("Nombre", text: $draftSenderFirstName)
                        TextField("Apellidos", text: $draftSenderLastName)
                    }
                    TextField("Telefono", text: $draftSenderPhone)
                }

                Section("Validación") {
                    Button("Validar borrador") {
                        draftShipmentMessage = validateShipmentDraft()
                    }
                    Text(draftShipmentMessage.isEmpty ? "Completa campos obligatorios para continuar." : draftShipmentMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Nuevo envío (beta)")
        }
    }

    private func login() async {
        do {
            let token = try await apiClient.login(email: email, password: password)
            authSession.updateToken(token)
            apiClient.setAuthToken(token.token)
            loginMessage = "Sesion activa"
            await loadAuthProfile()
            await loadRoute()
            await loadRouteQuality()
            if canAccessNetwork {
                await loadNetworkNodes()
            }
        } catch {
            loginMessage = "Error de login"
        }
    }

    private func loadRoute() async {
        guard isValidRouteDate(routeDateFilter) else {
            driverMessage = "Fecha invalida. Usa YYYY-MM-DD."
            return
        }
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

    private func loadNetworkNodes() async {
        do {
            hubs = try await apiClient.hubs(onlyActive: false, includeDeleted: networkIncludeDeleted)
            depots = try await apiClient.depots(hubId: nil, includeDeleted: networkIncludeDeleted)
            points = try await apiClient.points(hubId: nil, depotId: nil, includeDeleted: networkIncludeDeleted)
            if newDepotHubId.isEmpty {
                newDepotHubId = hubs.first?.id ?? ""
            }
            if newPointHubId.isEmpty {
                newPointHubId = hubs.first?.id ?? ""
            }
        } catch {
            networkMessage = "No se pudo cargar red operativa"
        }
    }

    private func loadAuthProfile() async {
        do {
            let me = try await apiClient.me()
            roleCodes = me.roles.map(\.code)
        } catch {
            roleCodes = []
        }
    }

    private func createPickup(type: String) async {
        let normalizedReference = pickupReference.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedReference.count >= 4 else {
            driverMessage = "Referencia pickup invalida."
            return
        }
        do {
            try await apiClient.createPickup(
                reference: normalizedReference,
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

    private func incidentCategory(for code: String) -> String {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if normalized.hasPrefix("ABSENT") { return "absent" }
        if normalized.hasPrefix("RETRY") { return "retry" }
        if normalized.hasPrefix("FAILED") { return "failed" }
        return "general"
    }

    private func isValidRouteDate(_ value: String) -> Bool {
        if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value) != nil
    }

    private func currentISODate() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private func inferDocumentType(_ documentId: String, fallback: String) -> String {
        let normalized = documentId.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if normalized.range(of: #"^[XYZ][0-9]{7}[A-Z]$"#, options: .regularExpression) != nil { return "NIE" }
        if normalized.range(of: #"^[0-9]{8}[A-Z]$"#, options: .regularExpression) != nil { return "DNI" }
        if normalized.range(of: #"^[A-HJNPQRSUVW][0-9]{7}[0-9A-J]$"#, options: .regularExpression) != nil { return "CIF" }
        return fallback
    }

    private func validateShipmentDraft() -> String {
        if draftRecipientDocument.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Documento de destinatario obligatorio."
        }
        if draftSenderDocument.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Documento de remitente obligatorio."
        }
        if draftRecipientDocType == "CIF" {
            if draftRecipientLegalName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return "Razon social del destinatario obligatoria."
            }
        } else if draftRecipientFirstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draftRecipientLastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Nombre y apellidos del destinatario obligatorios."
        }
        if draftSenderDocType == "CIF" {
            if draftSenderLegalName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return "Razon social del remitente obligatoria."
            }
        } else if draftSenderFirstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draftSenderLastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Nombre y apellidos del remitente obligatorios."
        }
        if draftRecipientPhone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Telefono del destinatario obligatorio."
        }
        if draftSenderPhone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Telefono del remitente obligatorio."
        }
        return "Borrador valido."
    }
}

#Preview {
    ContentView(apiClient: APIClient(baseURL: nil))
}
