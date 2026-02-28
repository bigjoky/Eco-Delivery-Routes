import Foundation

public struct PaginationMeta: Codable {
    public let page: Int
    public let perPage: Int
    public let total: Int
    public let lastPage: Int

    enum CodingKeys: String, CodingKey {
        case page
        case perPage = "per_page"
        case total
        case lastPage = "last_page"
    }

    public init(page: Int, perPage: Int, total: Int, lastPage: Int) {
        self.page = page
        self.perPage = perPage
        self.total = total
        self.lastPage = lastPage
    }
}

public struct PaginatedResponse<T: Codable>: Codable {
    public let data: [T]
    public let meta: PaginationMeta

    public init(data: [T], meta: PaginationMeta) {
        self.data = data
        self.meta = meta
    }
}

public struct AdvanceSummary: Codable, Identifiable {
    public let id: String
    public let subcontractorId: String
    public let subcontractorName: String?
    public let amountCents: Int
    public let currency: String
    public let status: String
    public let reason: String?
    public let requestDate: String
    public let approvedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case subcontractorId = "subcontractor_id"
        case subcontractorName = "subcontractor_name"
        case amountCents = "amount_cents"
        case currency
        case status
        case reason
        case requestDate = "request_date"
        case approvedAt = "approved_at"
    }

    public init(
        id: String,
        subcontractorId: String,
        subcontractorName: String?,
        amountCents: Int,
        currency: String,
        status: String,
        reason: String?,
        requestDate: String,
        approvedAt: String?
    ) {
        self.id = id
        self.subcontractorId = subcontractorId
        self.subcontractorName = subcontractorName
        self.amountCents = amountCents
        self.currency = currency
        self.status = status
        self.reason = reason
        self.requestDate = requestDate
        self.approvedAt = approvedAt
    }
}

public struct TariffSummary: Codable, Identifiable {
    public let id: String
    public let serviceType: String
    public let amountCents: Int
    public let currency: String
    public let validFrom: String
    public let validTo: String?
    public let hubId: String?
    public let subcontractorId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case serviceType = "service_type"
        case amountCents = "amount_cents"
        case currency
        case validFrom = "valid_from"
        case validTo = "valid_to"
        case hubId = "hub_id"
        case subcontractorId = "subcontractor_id"
    }

    public init(
        id: String,
        serviceType: String,
        amountCents: Int,
        currency: String,
        validFrom: String,
        validTo: String?,
        hubId: String?,
        subcontractorId: String?
    ) {
        self.id = id
        self.serviceType = serviceType
        self.amountCents = amountCents
        self.currency = currency
        self.validFrom = validFrom
        self.validTo = validTo
        self.hubId = hubId
        self.subcontractorId = subcontractorId
    }
}

public struct SettlementSummary: Codable, Identifiable {
    public let id: String
    public let subcontractorId: String
    public let subcontractorName: String?
    public let periodStart: String
    public let periodEnd: String
    public let status: String
    public let grossAmountCents: Int
    public let advancesAmountCents: Int
    public let adjustmentsAmountCents: Int?
    public let netAmountCents: Int
    public let currency: String

    enum CodingKeys: String, CodingKey {
        case id
        case subcontractorId = "subcontractor_id"
        case subcontractorName = "subcontractor_name"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case status
        case grossAmountCents = "gross_amount_cents"
        case advancesAmountCents = "advances_amount_cents"
        case adjustmentsAmountCents = "adjustments_amount_cents"
        case netAmountCents = "net_amount_cents"
        case currency
    }

    public init(
        id: String,
        subcontractorId: String,
        subcontractorName: String?,
        periodStart: String,
        periodEnd: String,
        status: String,
        grossAmountCents: Int,
        advancesAmountCents: Int,
        adjustmentsAmountCents: Int?,
        netAmountCents: Int,
        currency: String
    ) {
        self.id = id
        self.subcontractorId = subcontractorId
        self.subcontractorName = subcontractorName
        self.periodStart = periodStart
        self.periodEnd = periodEnd
        self.status = status
        self.grossAmountCents = grossAmountCents
        self.advancesAmountCents = advancesAmountCents
        self.adjustmentsAmountCents = adjustmentsAmountCents
        self.netAmountCents = netAmountCents
        self.currency = currency
    }
}
