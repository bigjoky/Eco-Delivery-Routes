import SharedCore
import SwiftUI
import UniformTypeIdentifiers
import Foundation
import AppKit

private struct RouteManifestAPIResponse: Decodable {
    let data: RouteManifestPayload
}

private struct RouteManifestPayload: Decodable {
    let route: RouteManifestRoute
    let totals: RouteManifestTotalsPayload
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
    let manifestNotes: String?

    enum CodingKeys: String, CodingKey {
        case id
        case code
        case routeDate = "route_date"
        case status
        case driverCode = "driver_code"
        case vehicleCode = "vehicle_code"
        case manifestNotes = "manifest_notes"
    }
}

private struct RouteManifestTotalsPayload: Decodable {
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

private struct RouteManifestRow: Identifiable {
    let id: String
    let sequence: Int
    let stopType: String
    let reference: String
    let status: String
}

private struct RouteManifestTotals {
    let stops: Int
    let deliveries: Int
    let pickups: Int
    let completed: Int
    let manifestNotes: String?
}

struct ContentView: View {
    private enum Section: String, CaseIterable, Identifiable {
        case operations = "Operativa"
        case quality = "Calidad"
        case advances = "Anticipos"
        case tariffs = "Tarifas"
        case settlements = "Liquidaciones"
        case users = "Usuarios"

        var id: String { rawValue }

        var systemImage: String {
            switch self {
            case .operations: "shippingbox"
            case .quality: "chart.bar"
            case .advances: "eurosign.circle"
            case .tariffs: "list.bullet.clipboard"
            case .settlements: "doc.plaintext"
            case .users: "person.3"
            }
        }
    }

    @EnvironmentObject private var authSession: AuthSession
    let apiClient: APIClientProtocol

    @State private var selectedSection: Section? = .operations
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
    @State private var selectedQualityRouteId: String?
    @State private var selectedRouteBreakdown: QualityRouteBreakdown?
    @State private var subcontractorQuality: [QualitySnapshot] = []
    @State private var selectedSubcontractorId: String?
    @State private var selectedSubcontractorBreakdown: QualitySubcontractorBreakdown?
    @State private var breakdownGranularity: String = "month"
    @State private var qualityPeriodStart: String = ""
    @State private var qualityPeriodEnd: String = ""
    @State private var qualityAlertThresholdText: String = "95"
    @State private var qualityThresholdSource: String = "default"
    @State private var qualityThresholdScopeType: String = "user"
    @State private var qualityThresholdScopeId: String = ""
    @State private var qualityThresholdBeforeValue: Double?
    @State private var qualityThresholdAfterValue: Double?
    @State private var qualityThresholdLargeDeltaCount: Int = 0
    @State private var qualityThresholdTopScopes: [QualityThresholdAlertTopScope] = []
    @State private var qualityThresholdAlertWindowHours: Int = 24
    @State private var qualityThresholdDeltaTrigger: Double = 5
    @State private var canManageQualityThreshold: Bool = false
    @State private var qualityThresholdMessage: String = ""
    @State private var advances: [AdvanceSummary] = []
    @State private var tariffs: [TariffSummary] = []
    @State private var settlements: [SettlementSummary] = []
    @State private var users: [User] = []
    @State private var userStatusFilter: String = ""

    @State private var scanCode: String = ""
    @State private var operationalMessage: String = "Recepcion lista"
    @State private var advancesMessage: String = ""
    @State private var usersMessage: String = ""
    @State private var email: String = "admin@eco.local"
    @State private var password: String = "password123"
    @State private var loginMessage: String = "No autenticado"
    @State private var manifestRouteId: String = ""
    @State private var manifestRouteCode: String = "-"
    @State private var manifestRouteDate: String = "-"
    @State private var manifestTotals: RouteManifestTotals = RouteManifestTotals(stops: 0, deliveries: 0, pickups: 0, completed: 0, manifestNotes: nil)
    @State private var manifestRows: [RouteManifestRow] = []
    @State private var manifestLoading: Bool = false
    @State private var manifestError: String?
    @State private var showImportPicker: Bool = false
    @State private var importFileUrl: URL?
    @State private var importDryRun: Bool = true
    @State private var importResult: ShipmentsImportResult?
    @State private var importMessage: String = ""
    @State private var importWarnings: [String] = []
    @State private var importRunning: Bool = false

    private var selectedStop: DriverStop? {
        routeStops.first(where: { $0.id == selectedStopId }) ?? routeStops.first
    }

    private var qualityAlertThreshold: Double {
        Double(qualityAlertThresholdText) ?? 95
    }

    var body: some View {
        Group {
            if authSession.token == nil {
                loginView
            } else {
                NavigationSplitView {
                    List(Section.allCases, selection: $selectedSection) { section in
                        Label(section.rawValue, systemImage: section.systemImage)
                            .tag(section)
                    }
                    .navigationTitle("Eco Delivery")
                } detail: {
                    switch selectedSection ?? .operations {
                    case .operations:
                        operationsTab
                    case .quality:
                        qualityTab
                    case .advances:
                        advancesTab
                    case .tariffs:
                        tariffsTab
                    case .settlements:
                        settlementsTab
                    case .users:
                        usersTab
                    }
                }
                .toolbar {
                    Button("Cerrar sesion") {
                        Task { await logout() }
                    }
                }
            }
        }
        .task {
            await refreshAll()
        }
    }

    private var loginView: some View {
        VStack(spacing: 12) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)
            Text("Warehouse / Traffic Login")
                .font(.headline)
            TextField("Email", text: $email)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .frame(maxWidth: 320)
            SecureField("Password", text: $password)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .frame(maxWidth: 320)
            Button("Entrar") {
                Task { await login() }
            }
            .disabled(email.isEmpty || password.isEmpty)
            Text(loginMessage)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var operationsTab: some View {
        HStack(spacing: 0) {
            List(routeStops) { stop in
                VStack(alignment: .leading) {
                    Text("\(selectedStop?.id == stop.id ? "[*]" : "[ ]") #\(stop.sequence) \(stop.stopType)")
                    Text(stop.reference).font(.caption)
                    Text(stop.status).font(.caption2).foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    selectedStopId = stop.id
                }
            }
            .frame(minWidth: 320, idealWidth: 360, maxWidth: 420)

            Divider()

            VStack(alignment: .leading, spacing: 12) {
                Text("Recepcion / Scan masivo")
                    .font(.title3)
                TextField("Fecha ruta (YYYY-MM-DD)", text: $routeDateFilter)
                TextField("Estado ruta (opcional)", text: $routeStatusFilter)
                Text("Parada activa: \(selectedStop?.reference ?? "-")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Codigo de escaneo", text: $scanCode)
                Button("Registrar scan") {
                    Task {
                        guard let target = selectedStop else { return }
                        do {
                            try await apiClient.registerScan(
                                trackableType: target.entityType,
                                trackableId: target.entityId,
                                scanCode: scanCode
                            )
                            operationalMessage = "Scan registrado en hub"
                        } catch {
                            operationalMessage = "Error de scan"
                        }
                    }
                }
                Text(operationalMessage).font(.caption)
                Button("Recargar manifiesto") {
                    Task { await loadRoute() }
                }
                Divider()
                Text("Manifest API (ruta por ID)")
                    .font(.headline)
                TextField("Route ID", text: $manifestRouteId)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                Button(manifestLoading ? "Cargando..." : "Cargar manifest") {
                    Task { await loadManifestById() }
                }
                .disabled(manifestLoading || manifestRouteId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Export CSV") {
                    Task { await exportManifest(format: "csv") }
                }
                .disabled(manifestRouteId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Export PDF") {
                    Task { await exportManifest(format: "pdf") }
                }
                .disabled(manifestRouteId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if let manifestError {
                    Text(manifestError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                Text("\(manifestRouteCode) | \(manifestRouteDate)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Stops: \(manifestTotals.stops) · Deliveries: \(manifestTotals.deliveries) · Pickups: \(manifestTotals.pickups) · Completed: \(manifestTotals.completed)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let notes = manifestTotals.manifestNotes, !notes.isEmpty {
                    Text("Notas: \(notes)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !manifestRows.isEmpty {
                    List(manifestRows.prefix(6)) { row in
                        VStack(alignment: .leading) {
                            Text("#\(row.sequence) \(row.stopType) \(row.reference)")
                                .font(.caption)
                            Text(row.status)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxHeight: 180)
                }
                Divider()
                Text("Importar envios CSV")
                    .font(.headline)
                HStack {
                    Button(importFileUrl == nil ? "Seleccionar CSV" : "CSV seleccionado") {
                        showImportPicker = true
                    }
                    Toggle("Dry run", isOn: $importDryRun)
                        .toggleStyle(.switch)
                    Button(importRunning ? "Importando..." : "Importar") {
                        Task { await importShipmentsCsv() }
                    }
                    .disabled(importRunning || importFileUrl == nil)
                    Button("Descargar plantilla") {
                        Task { await downloadShipmentsTemplate() }
                    }
                }
                if let importFileUrl {
                    Text(importFileUrl.lastPathComponent)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !importMessage.isEmpty {
                    Text(importMessage)
                        .font(.caption)
                        .foregroundStyle(importMessage.contains("Error") ? .red : .secondary)
                }
                if let importResult {
                    Text("Creados: \(importResult.createdCount) · Errores: \(importResult.errorCount)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !importWarnings.isEmpty {
                        Text("Avisos: \(importWarnings.joined(separator: ", "))")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                    if !importResult.rows.isEmpty {
                        List(importResult.rows.prefix(5)) { row in
                            VStack(alignment: .leading) {
                                Text("Fila \(row.row): \(row.reference ?? "-")")
                                    .font(.caption)
                                Text(row.status)
                                    .font(.caption2)
                                    .foregroundStyle(row.status == "error" ? .red : .secondary)
                                if let errors = row.errors, !errors.isEmpty {
                                    Text(errors.joined(separator: ", "))
                                        .font(.caption2)
                                        .foregroundStyle(.red)
                                }
                            }
                        }
                        .frame(maxHeight: 160)
                    }
                }
                Spacer()
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .navigationTitle("Manifiesto")
        .fileImporter(
            isPresented: $showImportPicker,
            allowedContentTypes: [UTType.commaSeparatedText],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                importFileUrl = urls.first
            case .failure:
                importMessage = "Error seleccionando CSV"
            }
        }
    }

    private var advancesTab: some View {
        NavigationStack {
            List(advances) { advance in
                VStack(alignment: .leading, spacing: 4) {
                    Text(advance.subcontractorName ?? advance.subcontractorId)
                        .font(.headline)
                    Text("\(formatCents(advance.amountCents, currency: advance.currency)) · \(advance.status)")
                        .font(.subheadline)
                    Text("Solicitud: \(advance.requestDate)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let reason = advance.reason, !reason.isEmpty {
                        Text(reason)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if advance.status == "requested" {
                        Button("Aprobar") {
                            Task { await approveAdvance(id: advance.id) }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            .navigationTitle("Anticipos")
            .toolbar {
                Button("Recargar") {
                    Task { await loadAdvances() }
                }
            }
            .overlay(alignment: .bottom) {
                if !advancesMessage.isEmpty {
                    Text(advancesMessage)
                        .font(.caption)
                        .padding(8)
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding()
                }
            }
        }
    }

    private var usersTab: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Estado", selection: $userStatusFilter) {
                    Text("Todos").tag("")
                    Text("active").tag("active")
                    Text("pending").tag("pending")
                    Text("suspended").tag("suspended")
                }
                .pickerStyle(.segmented)
                .onChange(of: userStatusFilter) { _, _ in
                    Task { await loadUsers() }
                }

                List(users) { user in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(user.name).font(.headline)
                        Text("\(user.email) · \(user.status)").font(.subheadline)
                        Text(user.roles.map(\.code).joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }

                if !usersMessage.isEmpty {
                    Text(usersMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .navigationTitle("Usuarios")
            .toolbar {
                Button("Recargar") {
                    Task { await loadUsers() }
                }
            }
        }
    }

    private var qualityTab: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Periodo inicio (YYYY-MM-DD)", text: $qualityPeriodStart)
                        TextField("Periodo fin (YYYY-MM-DD)", text: $qualityPeriodEnd)
                        TextField("Umbral alerta (%)", text: $qualityAlertThresholdText)
                        Picker("Scope", selection: $qualityThresholdScopeType) {
                            Text("Usuario").tag("user")
                            Text("Rol").tag("role")
                            Text("Global").tag("global")
                        }
                        .pickerStyle(.segmented)
                        if qualityThresholdScopeType != "global" {
                            TextField(
                                qualityThresholdScopeType == "role"
                                    ? "Scope ID (code rol, ej: driver)"
                                    : "Scope ID usuario (vacío = usuario actual)",
                                text: $qualityThresholdScopeId
                            )
                        }
                        HStack(spacing: 8) {
                            Text("Fuente umbral: \(qualityThresholdSource)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if !qualityThresholdScopeId.isEmpty {
                                Text("· Scope: \(qualityThresholdScopeId)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Button("Guardar umbral") {
                                Task { await saveQualityThreshold() }
                            }
                            .disabled(!canManageQualityThreshold)
                        }
                        if !qualityThresholdMessage.isEmpty {
                            Text(qualityThresholdMessage)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let before = qualityThresholdBeforeValue, let after = qualityThresholdAfterValue {
                            HStack(spacing: 8) {
                                Text(String(format: "%.2f%% → %.2f%%", before, after))
                                    .font(.caption)
                                Text(thresholdTrendLabel(before: before, after: after))
                                    .font(.caption2)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(thresholdTrendColor(before: before, after: after).opacity(0.18))
                                    .foregroundStyle(thresholdTrendColor(before: before, after: after))
                                    .clipShape(Capsule())
                            }
                        }
                        HStack(spacing: 8) {
                            Text("Alertas delta (ultimas \(qualityThresholdAlertWindowHours)h): \(qualityThresholdLargeDeltaCount)")
                                .font(.caption)
                                .foregroundStyle(qualityThresholdLargeDeltaCount > 0 ? .red : .secondary)
                            Text("Trigger: ±\(qualityThresholdDeltaTrigger, specifier: "%.2f")")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if !qualityThresholdTopScopes.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Top scopes alertas delta")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                ForEach(qualityThresholdTopScopes.prefix(5)) { scope in
                                    Text("\(scope.scopeType) · \(scope.scopeLabel ?? scope.scopeId ?? "-"): \(scope.alertsCount)")
                                        .font(.caption2)
                                }
                            }
                        }
                    }

                    let routeAlerts = routeQuality.filter { $0.serviceQualityScore < qualityAlertThreshold }
                    let subcontractorAlerts = subcontractorQuality.filter { $0.serviceQualityScore < qualityAlertThreshold }
                    if !routeAlerts.isEmpty || !subcontractorAlerts.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Alertas KPI < \(qualityAlertThreshold, specifier: "%.2f")%")
                                .font(.headline)
                            ForEach(routeAlerts.prefix(5)) { snapshot in
                                Text("Ruta \(snapshot.scopeLabel ?? snapshot.scopeId): \(snapshot.serviceQualityScore, specifier: "%.2f")%")
                                    .foregroundStyle(.red)
                            }
                            ForEach(subcontractorAlerts.prefix(5)) { snapshot in
                                Text("Subcontrata \(snapshot.scopeLabel ?? snapshot.scopeId): \(snapshot.serviceQualityScore, specifier: "%.2f")%")
                                    .foregroundStyle(.red)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    List(routeQuality) { snapshot in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(snapshot.scopeLabel ?? snapshot.scopeId)
                                    .font(.headline)
                                Spacer()
                                Button("Detalle") {
                                    selectedQualityRouteId = snapshot.scopeId
                                    Task { await loadRouteBreakdown(routeId: snapshot.scopeId) }
                                }
                            }
                            Text("Score: \(snapshot.serviceQualityScore, specifier: "%.2f")%")
                                .font(.subheadline)
                            Text("Periodo: \(snapshot.periodStart) - \(snapshot.periodEnd)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text("Completados: \(snapshot.deliveredCompleted + snapshot.pickupsCompleted)/\(snapshot.assignedWithAttempt)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                    .frame(minHeight: 260)

                    List(subcontractorQuality) { snapshot in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(snapshot.scopeLabel ?? snapshot.scopeId)
                                    .font(.headline)
                                Spacer()
                                Button("Detalle subcontrata") {
                                    selectedSubcontractorId = snapshot.scopeId
                                    Task { await loadSubcontractorBreakdown(subcontractorId: snapshot.scopeId) }
                                }
                            }
                            Text("Score: \(snapshot.serviceQualityScore, specifier: "%.2f")%")
                                .font(.subheadline)
                            Text("Periodo: \(snapshot.periodStart) - \(snapshot.periodEnd)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text("Completados: \(snapshot.deliveredCompleted + snapshot.pickupsCompleted)/\(snapshot.assignedWithAttempt)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                    .frame(minHeight: 220)

                    if let breakdown = selectedRouteBreakdown {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Desglose ruta \(breakdown.routeCode ?? breakdown.routeId)")
                                .font(.headline)
                            Text("Score agregado: \(breakdown.serviceQualityScore, specifier: "%.2f")%")
                            Text("Snapshots: \(breakdown.snapshotsCount)")
                                .foregroundStyle(.secondary)
                                .font(.caption)
                            Picker("Granularidad", selection: $breakdownGranularity) {
                                Text("Mensual").tag("month")
                                Text("Semanal").tag("week")
                            }
                            .pickerStyle(.segmented)
                            .onChange(of: breakdownGranularity) { _, _ in
                                guard let selectedQualityRouteId else { return }
                                Task {
                                    await loadRouteBreakdown(routeId: selectedQualityRouteId)
                                    if let selectedSubcontractorId {
                                        await loadSubcontractorBreakdown(subcontractorId: selectedSubcontractorId)
                                    }
                                }
                            }
                            Text("Asignados: \(breakdown.components.assignedWithAttempt)")
                            Text("Completados (entrega + recogida): \(breakdown.components.completedTotal)")
                            Text("Fallidas: \(breakdown.components.failedCount) · Ausencias: \(breakdown.components.absentCount) · Reintentos: \(breakdown.components.retryCount)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack {
                                Button("Exportar CSV") {
                                    guard let selectedQualityRouteId else { return }
                                    Task {
                                        try? await apiClient.exportQualityRouteBreakdownCsv(
                                            routeId: selectedQualityRouteId,
                                            periodStart: qualityPeriodStart.isEmpty ? nil : qualityPeriodStart,
                                            periodEnd: qualityPeriodEnd.isEmpty ? nil : qualityPeriodEnd,
                                            granularity: breakdownGranularity
                                        )
                                    }
                                }
                                Button("Exportar PDF") {
                                    guard let selectedQualityRouteId else { return }
                                    Task {
                                        try? await apiClient.exportQualityRouteBreakdownPdf(
                                            routeId: selectedQualityRouteId,
                                            periodStart: qualityPeriodStart.isEmpty ? nil : qualityPeriodStart,
                                            periodEnd: qualityPeriodEnd.isEmpty ? nil : qualityPeriodEnd,
                                            granularity: breakdownGranularity
                                        )
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else {
                        Text(selectedQualityRouteId == nil ? "Selecciona una ruta para ver el desglose KPI." : "Sin desglose disponible para esta ruta.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal)
                    }

                    if let breakdown = selectedSubcontractorBreakdown {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Desglose subcontrata \(breakdown.subcontractorCode ?? breakdown.subcontractorId)")
                                .font(.headline)
                            Text("Score agregado: \(breakdown.serviceQualityScore, specifier: "%.2f")%")
                            Text("Snapshots: \(breakdown.snapshotsCount)")
                                .foregroundStyle(.secondary)
                                .font(.caption)
                            Text("Asignados: \(breakdown.components.assignedWithAttempt)")
                            Text("Completados (entrega + recogida): \(breakdown.components.completedTotal)")
                            Text("Fallidas: \(breakdown.components.failedCount) · Ausencias: \(breakdown.components.absentCount) · Reintentos: \(breakdown.components.retryCount)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack {
                                Button("Exportar CSV subcontrata") {
                                    guard let selectedSubcontractorId else { return }
                                    Task {
                                        try? await apiClient.exportQualitySubcontractorBreakdownCsv(
                                            subcontractorId: selectedSubcontractorId,
                                            periodStart: qualityPeriodStart.isEmpty ? nil : qualityPeriodStart,
                                            periodEnd: qualityPeriodEnd.isEmpty ? nil : qualityPeriodEnd,
                                            granularity: breakdownGranularity
                                        )
                                    }
                                }
                                Button("Exportar PDF subcontrata") {
                                    guard let selectedSubcontractorId else { return }
                                    Task {
                                        try? await apiClient.exportQualitySubcontractorBreakdownPdf(
                                            subcontractorId: selectedSubcontractorId,
                                            periodStart: qualityPeriodStart.isEmpty ? nil : qualityPeriodStart,
                                            periodEnd: qualityPeriodEnd.isEmpty ? nil : qualityPeriodEnd,
                                            granularity: breakdownGranularity
                                        )
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else {
                        Text(selectedSubcontractorId == nil ? "Selecciona una subcontrata para ver el desglose KPI." : "Sin desglose disponible para esta subcontrata.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal)
                    }
                }
            }
            .navigationTitle("Calidad")
            .toolbar {
                Button("Recargar") {
                    Task { await loadRouteQuality() }
                }
            }
        }
    }

    private var tariffsTab: some View {
        NavigationStack {
            List(tariffs) { tariff in
                VStack(alignment: .leading, spacing: 4) {
                    Text(tariff.serviceType)
                        .font(.headline)
                    Text(formatCents(tariff.amountCents, currency: tariff.currency))
                        .font(.subheadline)
                    Text("Validez: \(tariff.validFrom) - \(tariff.validTo ?? "abierta")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
            .navigationTitle("Tarifas")
            .toolbar {
                Button("Recargar") {
                    Task { await loadTariffs() }
                }
            }
        }
    }

    private var settlementsTab: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    List(settlements) { settlement in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(settlement.subcontractorName ?? settlement.subcontractorId)
                                .font(.headline)
                            Text("Estado: \(settlement.status)")
                                .font(.subheadline)
                            Text("Periodo: \(settlement.periodStart) - \(settlement.periodEnd)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text("Neto: \(formatCents(settlement.netAmountCents, currency: settlement.currency))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                    .frame(minHeight: 260)

                    WarehouseReconciliationWidget()
                        .frame(minHeight: 280)
                        .background(.thinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .navigationTitle("Liquidaciones")
            .toolbar {
                Button("Recargar") {
                    Task { await loadSettlements() }
                }
            }
        }
    }

    private func refreshAll() async {
        apiClient.setAuthToken(authSession.token?.token)
        guard authSession.token != nil else { return }
        await loadQualityThreshold()
        await loadQualityThresholdAlerts()
        await loadRoute()
        await loadManifestById()
        await loadRouteQuality()
        await loadAdvances()
        await loadTariffs()
        await loadSettlements()
        await loadUsers()
    }

    private func loadRoute() async {
        let payload = try? await apiClient.myRoute(
            routeDate: routeDateFilter.isEmpty ? nil : routeDateFilter,
            status: routeStatusFilter.isEmpty ? nil : routeStatusFilter
        )
        routeStops = payload?.stops ?? []
        selectedStopId = routeStops.first?.id
        if manifestRouteId.isEmpty, let routeId = payload?.route?.id {
            manifestRouteId = routeId
        }
    }

    private func loadManifestById() async {
        let trimmedRouteId = manifestRouteId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedRouteId.isEmpty else { return }
        guard let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] else {
            manifestError = "API_BASE_URL no configurado"
            return
        }
        guard let url = URL(string: "\(baseURL)/routes/\(trimmedRouteId)/manifest") else {
            manifestError = "URL invalida"
            return
        }

        manifestLoading = true
        manifestError = nil
        defer { manifestLoading = false }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authSession.token?.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                manifestError = "Error HTTP al cargar manifest"
                return
            }
            let decoded = try JSONDecoder().decode(RouteManifestAPIResponse.self, from: data).data
            manifestRouteCode = decoded.route.code
            manifestRouteDate = decoded.route.routeDate
            manifestTotals = RouteManifestTotals(
                stops: decoded.totals.stops,
                deliveries: decoded.totals.deliveries,
                pickups: decoded.totals.pickups,
                completed: decoded.totals.completed,
                manifestNotes: decoded.route.manifestNotes
            )
            manifestRows = decoded.stops.map {
                RouteManifestRow(
                    id: $0.id,
                    sequence: $0.sequence,
                    stopType: $0.stopType,
                    reference: $0.reference ?? $0.entityId,
                    status: $0.status
                )
            }
        } catch {
            manifestError = "No se pudo cargar manifest"
        }
    }

    private func exportManifest(format: String) async {
        let trimmedRouteId = manifestRouteId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedRouteId.isEmpty else { return }
        guard let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] else {
            manifestError = "API_BASE_URL no configurado"
            return
        }
        guard let url = URL(string: "\(baseURL)/routes/\(trimmedRouteId)/manifest/export.\(format)") else {
            manifestError = "URL invalida"
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authSession.token?.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                manifestError = "Error HTTP al exportar manifest"
                return
            }

            await MainActor.run {
                let panel = NSSavePanel()
                panel.nameFieldStringValue = "route_manifest_\(trimmedRouteId).\(format)"
                panel.canCreateDirectories = true
                panel.begin { response in
                    guard response == .OK, let target = panel.url else { return }
                    do {
                        try data.write(to: target)
                    } catch {
                        manifestError = "No se pudo guardar el archivo"
                    }
                }
            }
        } catch {
            manifestError = "No se pudo exportar manifest"
        }
    }

    private func importShipmentsCsv() async {
        guard let importFileUrl else {
            importMessage = "Selecciona un CSV primero"
            return
        }
        importRunning = true
        importMessage = ""
        do {
            let result = try await apiClient.importShipmentsCsv(fileUrl: importFileUrl, dryRun: importDryRun)
            importResult = result
            importWarnings = result.warnings
            importMessage = result.dryRun ? "Dry run completado" : "Importacion completada"
        } catch {
            importMessage = "Error importando CSV"
        }
        importRunning = false
    }

    private func downloadShipmentsTemplate() async {
        do {
            let data = try await apiClient.downloadShipmentsTemplate()
            await MainActor.run {
                let panel = NSSavePanel()
                panel.nameFieldStringValue = "shipments_import_template.csv"
                panel.canCreateDirectories = true
                panel.begin { response in
                    guard response == .OK, let target = panel.url else { return }
                    do {
                        try data.write(to: target)
                        importMessage = "Plantilla guardada"
                    } catch {
                        importMessage = "No se pudo guardar la plantilla"
                    }
                }
            }
        } catch {
            importMessage = "Error descargando plantilla"
        }
    }

    private func loadRouteQuality() async {
        routeQuality = (try? await apiClient.qualitySnapshots(scopeType: "route")) ?? []
        subcontractorQuality = (try? await apiClient.qualitySnapshots(scopeType: "subcontractor")) ?? []
        if selectedQualityRouteId == nil {
            selectedQualityRouteId = routeQuality.first?.scopeId
        }
        if let selectedQualityRouteId {
            await loadRouteBreakdown(routeId: selectedQualityRouteId)
        }
        if selectedSubcontractorId == nil {
            selectedSubcontractorId = subcontractorQuality.first?.scopeId
        }
        if let selectedSubcontractorId {
            await loadSubcontractorBreakdown(subcontractorId: selectedSubcontractorId)
        }
    }

    private func loadQualityThreshold() async {
        guard let config = try? await apiClient.qualityThreshold() else { return }
        qualityAlertThresholdText = String(format: "%.2f", config.threshold)
        qualityThresholdBeforeValue = config.threshold
        qualityThresholdAfterValue = config.threshold
        qualityThresholdSource = config.sourceType
        qualityThresholdScopeType = config.sourceType == "default" ? "user" : config.sourceType
        qualityThresholdScopeId = config.sourceId ?? ""
        canManageQualityThreshold = config.canManage ?? false
    }

    private func saveQualityThreshold() async {
        guard let threshold = Double(qualityAlertThresholdText) else {
            qualityThresholdMessage = "Umbral invalido"
            return
        }

        do {
            let beforeValue = Double(qualityAlertThresholdText)
            let scopeType = qualityThresholdScopeType
            let scopeId = scopeType == "global"
                ? nil
                : (qualityThresholdScopeId.isEmpty ? nil : qualityThresholdScopeId)
            let updated = try await apiClient.updateQualityThreshold(
                threshold: threshold,
                scopeType: scopeType,
                scopeId: scopeId
            )
            qualityAlertThresholdText = String(format: "%.2f", updated.threshold)
            qualityThresholdBeforeValue = beforeValue
            qualityThresholdAfterValue = updated.threshold
            qualityThresholdSource = updated.sourceType
            qualityThresholdScopeId = updated.sourceId ?? qualityThresholdScopeId
            canManageQualityThreshold = updated.canManage ?? canManageQualityThreshold
            qualityThresholdMessage = "Umbral guardado"
            await loadQualityThresholdAlerts()
        } catch {
            qualityThresholdMessage = "No se pudo guardar el umbral"
        }
    }

    private func loadQualityThresholdAlerts() async {
        let dateFormatter = DateFormatter()
        dateFormatter.calendar = Calendar(identifier: .gregorian)
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let settings = try? await apiClient.qualityThresholdAlertSettings()
        let windowHours = settings?.windowHours ?? 24
        qualityThresholdAlertWindowHours = windowHours
        qualityThresholdDeltaTrigger = settings?.largeDeltaThreshold ?? 5

        let now = Date()
        let fromDate = Calendar(identifier: .gregorian).date(byAdding: .hour, value: -windowHours, to: now) ?? now
        let dateFrom = dateFormatter.string(from: fromDate)
        let dateTo = dateFormatter.string(from: now)

        let history = (try? await apiClient.qualityThresholdHistory(dateFrom: dateFrom, dateTo: dateTo)) ?? []
        qualityThresholdLargeDeltaCount = history.filter { $0.event == "quality.threshold.alert.large_delta" }.count
        qualityThresholdTopScopes = (try? await apiClient.qualityThresholdAlertTopScopes(dateFrom: dateFrom, dateTo: dateTo, limit: 5)) ?? []
    }

    private func loadRouteBreakdown(routeId: String) async {
        selectedRouteBreakdown = try? await apiClient.qualityRouteBreakdown(
            routeId: routeId,
            periodStart: qualityPeriodStart.isEmpty ? nil : qualityPeriodStart,
            periodEnd: qualityPeriodEnd.isEmpty ? nil : qualityPeriodEnd,
            granularity: breakdownGranularity
        )
    }

    private func loadSubcontractorBreakdown(subcontractorId: String) async {
        selectedSubcontractorBreakdown = try? await apiClient.qualitySubcontractorBreakdown(
            subcontractorId: subcontractorId,
            periodStart: qualityPeriodStart.isEmpty ? nil : qualityPeriodStart,
            periodEnd: qualityPeriodEnd.isEmpty ? nil : qualityPeriodEnd,
            granularity: breakdownGranularity
        )
    }

    private func loadAdvances() async {
        do {
            advances = try await apiClient.advances(status: nil, period: nil, page: 1, perPage: 50).data
        } catch {
            advances = []
            advancesMessage = "No se pudieron cargar anticipos"
        }
    }

    private func loadTariffs() async {
        tariffs = (try? await apiClient.tariffs(serviceType: nil)) ?? []
    }

    private func loadSettlements() async {
        settlements = (try? await apiClient.settlements(status: nil, period: nil, page: 1, perPage: 50).data) ?? []
    }

    private func loadUsers() async {
        do {
            users = try await apiClient.users(
                status: userStatusFilter.isEmpty ? nil : userStatusFilter,
                page: 1,
                perPage: 100
            ).data
            usersMessage = ""
        } catch {
            users = []
            usersMessage = "No se pudieron cargar usuarios"
        }
    }

    private func approveAdvance(id: String) async {
        do {
            _ = try await apiClient.approveAdvance(id: id)
            advancesMessage = "Anticipo aprobado"
            await loadAdvances()
        } catch {
            advancesMessage = "No se pudo aprobar el anticipo"
        }
    }

    private func formatCents(_ cents: Int, currency: String) -> String {
        let amount = Double(cents) / 100.0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount) \(currency)"
    }

    private func thresholdTrendLabel(before: Double, after: Double) -> String {
        if after > before { return "SUBE" }
        if after < before { return "BAJA" }
        return "IGUAL"
    }

    private func thresholdTrendColor(before: Double, after: Double) -> Color {
        if after > before { return .green }
        if after < before { return .orange }
        return .secondary
    }

    private func login() async {
        do {
            let token = try await apiClient.login(email: email, password: password)
            authSession.updateToken(token)
            apiClient.setAuthToken(token.token)
            loginMessage = "Sesion activa"
            await refreshAll()
        } catch {
            loginMessage = "Error de login"
        }
    }

    private func logout() async {
        await apiClient.logout()
        authSession.updateToken(nil)
        apiClient.setAuthToken(nil)
        loginMessage = "No autenticado"
    }
}

#Preview {
    ContentView(apiClient: APIClient(baseURL: nil))
}
