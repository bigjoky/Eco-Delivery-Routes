import SwiftUI

struct WarehouseReconciliationWidget: View {
    @State private var rows: [ExclusionSummaryRow] = []
    @State private var hubs: [HubOption] = []
    @State private var selectedHubId = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var period = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Conciliacion por motivo")
                    .font(.headline)
                Spacer()
                if isLoading { ProgressView().controlSize(.small) }
            }

            HStack(spacing: 8) {
                TextField("Periodo (YYYY-MM)", text: $period)
                    .textFieldStyle(.roundedBorder)
                Picker("Hub", selection: $selectedHubId) {
                    Text("Todos los hubs").tag("")
                    ForEach(hubs) { hub in
                        Text("\(hub.code) · \(hub.name)").tag(hub.id)
                    }
                }
                .pickerStyle(.menu)
                Button("Refrescar") {
                    Task { await loadSummary() }
                }
                .buttonStyle(.borderedProminent)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            List(rows) { row in
                HStack {
                    Text(row.exclusionCode)
                        .font(.system(.body, design: .monospaced))
                    Spacer()
                    Text("\(row.linesCount) lineas")
                        .foregroundStyle(.secondary)
                    Text(currency(row.excludedAmountCents))
                        .bold()
                }
            }
            .listStyle(.inset)
        }
        .padding()
        .task {
            await loadHubs()
            await loadSummary()
        }
    }

    private func loadSummary() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            rows = try await ExclusionSummaryClient().fetchSummary(
                period: period.trimmedOrNil,
                hubId: selectedHubId.trimmedOrNil
            )
        } catch {
            errorMessage = "No se pudo cargar resumen de conciliacion."
            rows = ExclusionSummaryRow.mock
        }
    }

    private func loadHubs() async {
        do {
            hubs = try await ExclusionSummaryClient().fetchHubs()
        } catch {
            hubs = HubOption.mock
        }
    }

    private func currency(_ cents: Int) -> String {
        let value = Double(cents) / 100.0
        return String(format: "%.2f EUR", value)
    }
}

private struct ExclusionSummaryClient {
    func fetchSummary(period: String?, hubId: String?) async throws -> [ExclusionSummaryRow] {
        guard let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] else {
            return ExclusionSummaryRow.mock
        }
        var normalized = baseURL
        if normalized.hasSuffix("/api") {
            normalized += "/v1"
        } else if !normalized.hasSuffix("/api/v1") {
            normalized += "/api/v1"
        }
        guard var components = URLComponents(string: normalized + "/settlements/reconciliation-summary") else {
            return ExclusionSummaryRow.mock
        }

        var queryItems: [URLQueryItem] = []
        if let period { queryItems.append(URLQueryItem(name: "period", value: period)) }
        if let hubId { queryItems.append(URLQueryItem(name: "hub_id", value: hubId)) }
        components.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components.url else { return ExclusionSummaryRow.mock }
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        if let token = ProcessInfo.processInfo.environment["API_TOKEN"], !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw URLError(.badServerResponse)
        }
        let decoded = try JSONDecoder.eco().decode(ExclusionSummaryEnvelope.self, from: data)
        return decoded.data
    }

    func fetchHubs() async throws -> [HubOption] {
        guard let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] else {
            return HubOption.mock
        }
        var normalized = baseURL
        if normalized.hasSuffix("/api") {
            normalized += "/v1"
        } else if !normalized.hasSuffix("/api/v1") {
            normalized += "/api/v1"
        }
        guard let url = URL(string: normalized + "/hubs?only_active=1") else {
            return HubOption.mock
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        if let token = ProcessInfo.processInfo.environment["API_TOKEN"], !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw URLError(.badServerResponse)
        }
        let decoded = try JSONDecoder.eco().decode(HubEnvelope.self, from: data)
        return decoded.data
    }
}

private struct ExclusionSummaryEnvelope: Decodable {
    let data: [ExclusionSummaryRow]
}

private struct HubEnvelope: Decodable {
    let data: [HubOption]
}

private struct ExclusionSummaryRow: Decodable, Identifiable {
    var id: String { exclusionCode }

    let exclusionCode: String
    let linesCount: Int
    let excludedAmountCents: Int

    enum CodingKeys: String, CodingKey {
        case exclusionCode = "exclusion_code"
        case linesCount = "lines_count"
        case excludedAmountCents = "excluded_amount_cents"
    }

    static let mock: [ExclusionSummaryRow] = [
        .init(exclusionCode: "MANUAL_AUDIT", linesCount: 4, excludedAmountCents: 910),
        .init(exclusionCode: "RETRY_NOT_PAYABLE", linesCount: 3, excludedAmountCents: 570),
    ]
}

private struct HubOption: Decodable, Identifiable {
    let id: String
    let code: String
    let name: String

    static let mock: [HubOption] = [
        .init(id: "hub-1", code: "AGP-HUB-01", name: "Hub Malaga Centro"),
        .init(id: "hub-2", code: "SEV-HUB-01", name: "Hub Sevilla Norte"),
    ]
}

private extension JSONDecoder {
    static func eco() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }
}

private extension String {
    var trimmedOrNil: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
