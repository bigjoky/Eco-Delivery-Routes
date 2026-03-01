import Foundation

public protocol APIClientProtocol {
    func setAuthToken(_ token: String?)
    func login(email: String, password: String) async throws -> AuthToken
    func logout() async
    func myRoute(routeDate: String?, status: String?) async throws -> DriverRouteMePayload
    func myRouteStops() async throws -> [DriverStop]
    func users(status: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<User>
    func advances(status: String?, period: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<AdvanceSummary>
    func approveAdvance(id: String) async throws -> AdvanceSummary
    func tariffs(serviceType: String?) async throws -> [TariffSummary]
    func settlements(status: String?, period: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<SettlementSummary>
    func registerScan(trackableType: String, trackableId: String, scanCode: String) async throws
    func registerPod(evidenceType: String, evidenceId: String, signatureName: String) async throws
    func createPickup(reference: String, pickupType: String, hubId: String) async throws
    func registerIncident(
        incidentableType: String,
        incidentableId: String,
        catalogCode: String,
        category: String,
        notes: String
    ) async throws
    func qualitySnapshots(scopeType: String?) async throws -> [QualitySnapshot]
    func qualityRouteBreakdown(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws -> QualityRouteBreakdown
    func qualitySubcontractorBreakdown(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws -> QualitySubcontractorBreakdown
    func qualityThreshold() async throws -> QualityThresholdConfig
    func updateQualityThreshold(threshold: Double, scopeType: String?, scopeId: String?) async throws -> QualityThresholdConfig
    func qualityThresholdAlertSettings() async throws -> QualityThresholdAlertSettings
    func qualityThresholdHistory(dateFrom: String?, dateTo: String?) async throws -> [QualityThresholdHistoryEntry]
    func qualityThresholdAlertTopScopes(dateFrom: String?, dateTo: String?, limit: Int?) async throws -> [QualityThresholdAlertTopScope]
    func exportQualityRouteBreakdownCsv(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws
    func exportQualityRouteBreakdownPdf(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws
    func exportQualitySubcontractorBreakdownCsv(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws
    func exportQualitySubcontractorBreakdownPdf(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws
    func downloadShipmentsTemplate() async throws -> Data
    func importShipmentsCsv(fileUrl: URL, dryRun: Bool) async throws -> ShipmentsImportResult
}

public final class APIClient: APIClientProtocol {
    private let baseURL: URL?
    private let mock: MockAPIClient
    private var token: String?

    public init(baseURL: URL?) {
        self.baseURL = baseURL
        self.mock = MockAPIClient()
    }

    public func setAuthToken(_ token: String?) {
        self.token = token
    }

    public func logout() async {
        guard let baseURL else {
            token = nil
            return
        }

        var request = URLRequest(url: baseURL.appending(path: "auth/logout"))
        request.httpMethod = "POST"
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        _ = try? await URLSession.shared.data(for: request)
        token = nil
    }

    public func login(email: String, password: String) async throws -> AuthToken {
        guard let baseURL else { return try await mock.login(email: email, password: password) }

        var request = URLRequest(url: baseURL.appending(path: "auth/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": email,
            "password": password,
            "device_name": "apple-driver"
        ])

        let (data, _) = try await URLSession.shared.data(for: request)
        let decoded = try JSONDecoder().decode(LoginResponse.self, from: data)
        let authToken = AuthToken(token: decoded.token, tokenType: decoded.tokenType)
        self.token = authToken.token
        return authToken
    }

    public func myRouteStops() async throws -> [DriverStop] {
        try await myRoute(routeDate: nil, status: nil).stops
    }

    public func myRoute(routeDate: String?, status: String?) async throws -> DriverRouteMePayload {
        guard let baseURL else { return try await mock.myRoute(routeDate: routeDate, status: status) }

        let url = withQueryItems(
            baseURL.appending(path: "driver/me/route"),
            queryItems: [
                URLQueryItem(name: "route_date", value: routeDate),
                URLQueryItem(name: "status", value: status),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        let decoded = try JSONDecoder().decode(DriverRouteEnvelope.self, from: data)
        let normalizedStops = decoded.data.stops.map {
            let fallbackType = ($0.stopType.uppercased() == "PICKUP") ? "pickup" : "shipment"
            let entityType = $0.entityType ?? fallbackType
            let entityId = $0.entityId ?? $0.shipmentId ?? $0.pickupId ?? ""
            return DriverStop(
                id: $0.id,
                sequence: $0.sequence,
                stopType: $0.stopType,
                entityType: entityType,
                entityId: entityId,
                reference: $0.reference ?? entityId,
                status: $0.status
            )
        }

        return DriverRouteMePayload(
            driver: decoded.data.driver,
            route: decoded.data.route,
            stops: normalizedStops
        )
    }

    public func users(status: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<User> {
        guard let baseURL else { return try await mock.users(status: status, page: page, perPage: perPage) }

        let url = withQueryItems(
            baseURL.appending(path: "users"),
            queryItems: [
                URLQueryItem(name: "status", value: status),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "per_page", value: String(perPage)),
                URLQueryItem(name: "sort", value: "created_at"),
                URLQueryItem(name: "dir", value: "desc"),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(PaginatedResponse<User>.self, from: data)
    }

    public func advances(status: String?, period: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<AdvanceSummary> {
        guard let baseURL else { return try await mock.advances(status: status, period: period, page: page, perPage: perPage) }

        let url = withQueryItems(
            baseURL.appending(path: "advances"),
            queryItems: [
                URLQueryItem(name: "status", value: status),
                URLQueryItem(name: "period", value: period),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "per_page", value: String(perPage)),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(PaginatedResponse<AdvanceSummary>.self, from: data)
    }

    public func approveAdvance(id: String) async throws -> AdvanceSummary {
        guard let baseURL else { return try await mock.approveAdvance(id: id) }

        let request = authorizedRequest(url: baseURL.appending(path: "advances/\(id)/approve"), method: "POST")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<AdvanceSummary>.self, from: data).data
    }

    public func tariffs(serviceType: String?) async throws -> [TariffSummary] {
        guard let baseURL else { return try await mock.tariffs(serviceType: serviceType) }

        let url = withQueryItems(
            baseURL.appending(path: "tariffs"),
            queryItems: [URLQueryItem(name: "service_type", value: serviceType)]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataArrayEnvelope<TariffSummary>.self, from: data).data
    }

    public func settlements(status: String?, period: String?, page: Int, perPage: Int) async throws -> PaginatedResponse<SettlementSummary> {
        guard let baseURL else { return try await mock.settlements(status: status, period: period, page: page, perPage: perPage) }

        let url = withQueryItems(
            baseURL.appending(path: "settlements"),
            queryItems: [
                URLQueryItem(name: "status", value: status),
                URLQueryItem(name: "period", value: period),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "per_page", value: String(perPage)),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(PaginatedResponse<SettlementSummary>.self, from: data)
    }

    public func registerScan(trackableType: String, trackableId: String, scanCode: String) async throws {
        guard let baseURL else { return try await mock.registerScan(trackableType: trackableType, trackableId: trackableId, scanCode: scanCode) }

        var request = authorizedRequest(url: baseURL.appending(path: "tracking-events"), method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "trackable_type": trackableType,
            "trackable_id": trackableId,
            "event_code": "SCAN",
            "scan_code": scanCode,
            "occurred_at": ISO8601DateFormatter().string(from: Date())
        ])

        _ = try await execute(request)
    }

    public func registerPod(evidenceType: String, evidenceId: String, signatureName: String) async throws {
        guard let baseURL else { return try await mock.registerPod(evidenceType: evidenceType, evidenceId: evidenceId, signatureName: signatureName) }

        var request = authorizedRequest(url: baseURL.appending(path: "pods"), method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "evidenceable_type": evidenceType,
            "evidenceable_id": evidenceId,
            "signature_name": signatureName
        ])

        _ = try await execute(request)
    }

    public func createPickup(reference: String, pickupType: String, hubId: String) async throws {
        guard let baseURL else { return try await mock.createPickup(reference: reference, pickupType: pickupType, hubId: hubId) }

        var request = authorizedRequest(url: baseURL.appending(path: "pickups"), method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "hub_id": hubId,
            "reference": reference,
            "pickup_type": pickupType
        ])

        _ = try await execute(request)
    }

    public func registerIncident(
        incidentableType: String,
        incidentableId: String,
        catalogCode: String,
        category: String,
        notes: String
    ) async throws {
        guard let baseURL else {
            return try await mock.registerIncident(
                incidentableType: incidentableType,
                incidentableId: incidentableId,
                catalogCode: catalogCode,
                category: category,
                notes: notes
            )
        }

        var request = authorizedRequest(url: baseURL.appending(path: "incidents"), method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "incidentable_type": incidentableType,
            "incidentable_id": incidentableId,
            "catalog_code": catalogCode,
            "category": category,
            "notes": notes,
        ])

        _ = try await execute(request)
    }

    public func qualitySnapshots(scopeType: String?) async throws -> [QualitySnapshot] {
        guard let baseURL else { return try await mock.qualitySnapshots(scopeType: scopeType) }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality"),
            queryItems: [URLQueryItem(name: "scope_type", value: scopeType)]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataEnvelope<QualitySnapshot>.self, from: data).data
    }

    public func qualityRouteBreakdown(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws -> QualityRouteBreakdown {
        guard let baseURL else {
            return try await mock.qualityRouteBreakdown(routeId: routeId, periodStart: periodStart, periodEnd: periodEnd, granularity: granularity)
        }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/routes/\(routeId)/breakdown"),
            queryItems: [
                URLQueryItem(name: "period_start", value: periodStart),
                URLQueryItem(name: "period_end", value: periodEnd),
                URLQueryItem(name: "granularity", value: granularity),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<QualityRouteBreakdown>.self, from: data).data
    }

    public func exportQualityRouteBreakdownCsv(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        guard let baseURL else {
            return try await mock.exportQualityRouteBreakdownCsv(routeId: routeId, periodStart: periodStart, periodEnd: periodEnd, granularity: granularity)
        }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/routes/\(routeId)/breakdown/export.csv"),
            queryItems: [
                URLQueryItem(name: "period_start", value: periodStart),
                URLQueryItem(name: "period_end", value: periodEnd),
                URLQueryItem(name: "granularity", value: granularity),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        _ = try await execute(request)
    }

    public func exportQualityRouteBreakdownPdf(routeId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        guard let baseURL else {
            return try await mock.exportQualityRouteBreakdownPdf(routeId: routeId, periodStart: periodStart, periodEnd: periodEnd, granularity: granularity)
        }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/routes/\(routeId)/breakdown/export.pdf"),
            queryItems: [
                URLQueryItem(name: "period_start", value: periodStart),
                URLQueryItem(name: "period_end", value: periodEnd),
                URLQueryItem(name: "granularity", value: granularity),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        _ = try await execute(request)
    }

    public func qualitySubcontractorBreakdown(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws -> QualitySubcontractorBreakdown {
        guard let baseURL else {
            return try await mock.qualitySubcontractorBreakdown(subcontractorId: subcontractorId, periodStart: periodStart, periodEnd: periodEnd, granularity: granularity)
        }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/subcontractors/\(subcontractorId)/breakdown"),
            queryItems: [
                URLQueryItem(name: "period_start", value: periodStart),
                URLQueryItem(name: "period_end", value: periodEnd),
                URLQueryItem(name: "granularity", value: granularity),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<QualitySubcontractorBreakdown>.self, from: data).data
    }

    public func exportQualitySubcontractorBreakdownCsv(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        guard let baseURL else {
            return try await mock.exportQualitySubcontractorBreakdownCsv(subcontractorId: subcontractorId, periodStart: periodStart, periodEnd: periodEnd, granularity: granularity)
        }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/subcontractors/\(subcontractorId)/breakdown/export.csv"),
            queryItems: [
                URLQueryItem(name: "period_start", value: periodStart),
                URLQueryItem(name: "period_end", value: periodEnd),
                URLQueryItem(name: "granularity", value: granularity),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        _ = try await execute(request)
    }

    public func exportQualitySubcontractorBreakdownPdf(subcontractorId: String, periodStart: String?, periodEnd: String?, granularity: String?) async throws {
        guard let baseURL else {
            return try await mock.exportQualitySubcontractorBreakdownPdf(subcontractorId: subcontractorId, periodStart: periodStart, periodEnd: periodEnd, granularity: granularity)
        }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/subcontractors/\(subcontractorId)/breakdown/export.pdf"),
            queryItems: [
                URLQueryItem(name: "period_start", value: periodStart),
                URLQueryItem(name: "period_end", value: periodEnd),
                URLQueryItem(name: "granularity", value: granularity),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        _ = try await execute(request)
    }

    public func downloadShipmentsTemplate() async throws -> Data {
        guard let baseURL else { return try await mock.downloadShipmentsTemplate() }

        let request = authorizedRequest(url: baseURL.appending(path: "shipments/template.csv"), method: "GET")
        return try await execute(request)
    }

    public func importShipmentsCsv(fileUrl: URL, dryRun: Bool) async throws -> ShipmentsImportResult {
        guard let baseURL else { return try await mock.importShipmentsCsv(fileUrl: fileUrl, dryRun: dryRun) }

        let boundary = "Boundary-\(UUID().uuidString)"
        let url = withQueryItems(
            baseURL.appending(path: "shipments/import"),
            queryItems: [
                URLQueryItem(name: "dry_run", value: dryRun ? "1" : "0"),
            ]
        )
        var request = authorizedRequest(url: url, method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = try multipartBody(fileUrl: fileUrl, fieldName: "file", boundary: boundary)
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<ShipmentsImportResult>.self, from: data).data
    }

    public func qualityThreshold() async throws -> QualityThresholdConfig {
        guard let baseURL else { return try await mock.qualityThreshold() }

        let request = authorizedRequest(url: baseURL.appending(path: "kpis/quality/threshold"), method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<QualityThresholdConfig>.self, from: data).data
    }

    public func updateQualityThreshold(threshold: Double, scopeType: String?, scopeId: String?) async throws -> QualityThresholdConfig {
        guard let baseURL else {
            return try await mock.updateQualityThreshold(threshold: threshold, scopeType: scopeType, scopeId: scopeId)
        }

        var request = authorizedRequest(url: baseURL.appending(path: "kpis/quality/threshold"), method: "PUT")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var payload: [String: Any] = ["threshold": threshold]
        if let scopeType {
            payload["scope_type"] = scopeType
        }
        if let scopeId {
            payload["scope_id"] = scopeId
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<QualityThresholdConfig>.self, from: data).data
    }

    public func qualityThresholdAlertSettings() async throws -> QualityThresholdAlertSettings {
        guard let baseURL else { return try await mock.qualityThresholdAlertSettings() }

        let request = authorizedRequest(url: baseURL.appending(path: "kpis/quality/threshold/alert-settings"), method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataObjectEnvelope<QualityThresholdAlertSettings>.self, from: data).data
    }

    public func qualityThresholdHistory(dateFrom: String?, dateTo: String?) async throws -> [QualityThresholdHistoryEntry] {
        guard let baseURL else { return try await mock.qualityThresholdHistory(dateFrom: dateFrom, dateTo: dateTo) }

        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/threshold/history"),
            queryItems: [
                URLQueryItem(name: "date_from", value: dateFrom),
                URLQueryItem(name: "date_to", value: dateTo),
                URLQueryItem(name: "page", value: "1"),
                URLQueryItem(name: "per_page", value: "100"),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(PaginatedResponse<QualityThresholdHistoryEntry>.self, from: data).data
    }

    public func qualityThresholdAlertTopScopes(dateFrom: String?, dateTo: String?, limit: Int?) async throws -> [QualityThresholdAlertTopScope] {
        guard let baseURL else {
            return try await mock.qualityThresholdAlertTopScopes(dateFrom: dateFrom, dateTo: dateTo, limit: limit)
        }

        let normalizedLimit = max(1, min(limit ?? 5, 100))
        let url = withQueryItems(
            baseURL.appending(path: "kpis/quality/threshold/history/alerts/top-scopes"),
            queryItems: [
                URLQueryItem(name: "date_from", value: dateFrom),
                URLQueryItem(name: "date_to", value: dateTo),
                URLQueryItem(name: "limit", value: String(normalizedLimit)),
            ]
        )
        let request = authorizedRequest(url: url, method: "GET")
        let data = try await execute(request)
        return try JSONDecoder().decode(DataEnvelope<QualityThresholdAlertTopScope>.self, from: data).data
    }

    private func authorizedRequest(url: URL, method: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func execute(_ request: URLRequest) async throws -> Data {
        var currentRequest = request
        let (data, response) = try await URLSession.shared.data(for: currentRequest)
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        if http.statusCode == 401, try await refreshToken(), let refreshed = token {
            currentRequest.setValue("Bearer \(refreshed)", forHTTPHeaderField: "Authorization")
            let (retryData, retryResponse) = try await URLSession.shared.data(for: currentRequest)
            guard let retryHttp = retryResponse as? HTTPURLResponse else {
                throw APIClientError.invalidResponse
            }
            guard (200...299).contains(retryHttp.statusCode) else {
                throw APIClientError.httpStatus(retryHttp.statusCode)
            }
            return retryData
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIClientError.httpStatus(http.statusCode)
        }
        return data
    }

    private func refreshToken() async throws -> Bool {
        guard let baseURL, let token else { return false }

        var request = URLRequest(url: baseURL.appending(path: "auth/refresh"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            self.token = nil
            return false
        }

        let decoded = try JSONDecoder().decode(LoginResponse.self, from: data)
        self.token = decoded.token
        return true
    }

    private func withQueryItems(_ url: URL, queryItems: [URLQueryItem]) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }

        let filtered = queryItems.filter { item in
            guard let value = item.value else { return false }
            return !value.isEmpty
        }
        components.queryItems = filtered.isEmpty ? nil : filtered
        return components.url ?? url
    }

    private func multipartBody(fileUrl: URL, fieldName: String, boundary: String) throws -> Data {
        let fileData = try Data(contentsOf: fileUrl)
        let filename = fileUrl.lastPathComponent
        let mimeType = "text/csv"

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        return body
    }
}

private enum APIClientError: Error {
    case invalidResponse
    case httpStatus(Int)
}

private struct LoginResponse: Decodable {
    let token: String
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case token
        case tokenType = "token_type"
    }
}

private struct DataEnvelope<T: Decodable>: Decodable {
    let data: [T]
}

private struct DataObjectEnvelope<T: Decodable>: Decodable {
    let data: T
}

private struct DataArrayEnvelope<T: Decodable>: Decodable {
    let data: [T]
}

private struct StopPayload: Decodable {
    let id: String
    let sequence: Int
    let stopType: String
    let entityType: String?
    let entityId: String?
    let reference: String?
    let shipmentId: String?
    let pickupId: String?
    let status: String

    enum CodingKeys: String, CodingKey {
        case id, sequence, status
        case stopType = "stop_type"
        case entityType = "entity_type"
        case entityId = "entity_id"
        case reference
        case shipmentId = "shipment_id"
        case pickupId = "pickup_id"
    }
}

private struct DriverRouteEnvelope: Decodable {
    let data: DriverRouteData
}

private struct DriverRouteData: Decodable {
    let driver: DriverIdentity?
    let route: DriverRouteIdentity?
    let stops: [StopPayload]
}
