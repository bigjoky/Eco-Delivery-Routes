import SharedCore
import SwiftUI
import Foundation

struct ContentView: View {
    private enum Section: String, CaseIterable, Identifiable {
        case operations = "Operativa"
        case quality = "Calidad"
        case advances = "Anticipos"
        case tariffs = "Tarifas"
        case settlements = "Liquidaciones"

        var id: String { rawValue }

        var systemImage: String {
            switch self {
            case .operations: "shippingbox"
            case .quality: "chart.bar"
            case .advances: "eurosign.circle"
            case .tariffs: "list.bullet.clipboard"
            case .settlements: "doc.plaintext"
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
    @State private var canManageQualityThreshold: Bool = false
    @State private var qualityThresholdMessage: String = ""
    @State private var advances: [AdvanceSummary] = []
    @State private var tariffs: [TariffSummary] = []
    @State private var settlements: [SettlementSummary] = []

    @State private var scanCode: String = ""
    @State private var operationalMessage: String = "Recepcion lista"
    @State private var advancesMessage: String = ""

    private var selectedStop: DriverStop? {
        routeStops.first(where: { $0.id == selectedStopId }) ?? routeStops.first
    }

    private var qualityAlertThreshold: Double {
        Double(qualityAlertThresholdText) ?? 95
    }

    var body: some View {
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
            }
        }
        .task {
            await refreshAll()
        }
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
                Spacer()
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .navigationTitle("Manifiesto")
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

    private var qualityTab: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Periodo inicio (YYYY-MM-DD)", text: $qualityPeriodStart)
                        TextField("Periodo fin (YYYY-MM-DD)", text: $qualityPeriodEnd)
                        TextField("Umbral alerta (%)", text: $qualityAlertThresholdText)
                        HStack(spacing: 8) {
                            Text("Fuente umbral: \(qualityThresholdSource)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
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
        await loadQualityThreshold()
        await loadRoute()
        await loadRouteQuality()
        await loadAdvances()
        await loadTariffs()
        await loadSettlements()
    }

    private func loadRoute() async {
        let payload = try? await apiClient.myRoute(
            routeDate: routeDateFilter.isEmpty ? nil : routeDateFilter,
            status: routeStatusFilter.isEmpty ? nil : routeStatusFilter
        )
        routeStops = payload?.stops ?? []
        selectedStopId = routeStops.first?.id
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
        qualityThresholdSource = config.sourceType
        canManageQualityThreshold = config.canManage ?? false
    }

    private func saveQualityThreshold() async {
        guard let threshold = Double(qualityAlertThresholdText) else {
            qualityThresholdMessage = "Umbral invalido"
            return
        }

        do {
            let updated = try await apiClient.updateQualityThreshold(
                threshold: threshold,
                scopeType: "user",
                scopeId: nil
            )
            qualityAlertThresholdText = String(format: "%.2f", updated.threshold)
            qualityThresholdSource = updated.sourceType
            canManageQualityThreshold = updated.canManage ?? canManageQualityThreshold
            qualityThresholdMessage = "Umbral guardado"
        } catch {
            qualityThresholdMessage = "No se pudo guardar el umbral"
        }
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
}

#Preview {
    ContentView(apiClient: APIClient(baseURL: nil))
}
