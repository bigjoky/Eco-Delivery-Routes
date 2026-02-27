import Foundation

public struct QualitySnapshot: Codable, Identifiable {
    public let id: String
    public let scopeType: String
    public let scopeId: String
    public let scopeLabel: String?
    public let periodStart: String
    public let periodEnd: String
    public let serviceQualityScore: Double
    public let assignedWithAttempt: Int
    public let deliveredCompleted: Int
    public let pickupsCompleted: Int

    enum CodingKeys: String, CodingKey {
        case id
        case scopeType = "scope_type"
        case scopeId = "scope_id"
        case scopeLabel = "scope_label"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case serviceQualityScore = "service_quality_score"
        case assignedWithAttempt = "assigned_with_attempt"
        case deliveredCompleted = "delivered_completed"
        case pickupsCompleted = "pickups_completed"
    }

    public init(
        id: String,
        scopeType: String,
        scopeId: String,
        scopeLabel: String?,
        periodStart: String,
        periodEnd: String,
        serviceQualityScore: Double,
        assignedWithAttempt: Int,
        deliveredCompleted: Int,
        pickupsCompleted: Int
    ) {
        self.id = id
        self.scopeType = scopeType
        self.scopeId = scopeId
        self.scopeLabel = scopeLabel
        self.periodStart = periodStart
        self.periodEnd = periodEnd
        self.serviceQualityScore = serviceQualityScore
        self.assignedWithAttempt = assignedWithAttempt
        self.deliveredCompleted = deliveredCompleted
        self.pickupsCompleted = pickupsCompleted
    }
}
