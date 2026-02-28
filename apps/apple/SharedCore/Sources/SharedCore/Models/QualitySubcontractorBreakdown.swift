import Foundation

public struct QualitySubcontractorBreakdown: Codable {
    public let scopeType: String
    public let scopeId: String
    public let scopeLabel: String?
    public let subcontractorId: String
    public let subcontractorCode: String?
    public let granularity: String
    public let latestSnapshotId: String?
    public let latestPeriodStart: String?
    public let latestPeriodEnd: String?
    public let snapshotsCount: Int
    public let serviceQualityScore: Double
    public let periods: [Period]
    public let components: Components

    public struct Period: Codable, Identifiable {
        public var id: String { periodKey }

        public let periodKey: String
        public let periodStart: String
        public let periodEnd: String
        public let serviceQualityScore: Double
        public let components: Components

        enum CodingKeys: String, CodingKey {
            case periodKey = "period_key"
            case periodStart = "period_start"
            case periodEnd = "period_end"
            case serviceQualityScore = "service_quality_score"
            case components
        }
    }

    public struct Components: Codable {
        public let assignedWithAttempt: Int
        public let deliveredCompleted: Int
        public let pickupsCompleted: Int
        public let failedCount: Int
        public let absentCount: Int
        public let retryCount: Int
        public let completedTotal: Int
        public let completionRatio: Double

        enum CodingKeys: String, CodingKey {
            case assignedWithAttempt = "assigned_with_attempt"
            case deliveredCompleted = "delivered_completed"
            case pickupsCompleted = "pickups_completed"
            case failedCount = "failed_count"
            case absentCount = "absent_count"
            case retryCount = "retry_count"
            case completedTotal = "completed_total"
            case completionRatio = "completion_ratio"
        }
    }

    enum CodingKeys: String, CodingKey {
        case scopeType = "scope_type"
        case scopeId = "scope_id"
        case scopeLabel = "scope_label"
        case subcontractorId = "subcontractor_id"
        case subcontractorCode = "subcontractor_code"
        case granularity
        case latestSnapshotId = "latest_snapshot_id"
        case latestPeriodStart = "latest_period_start"
        case latestPeriodEnd = "latest_period_end"
        case snapshotsCount = "snapshots_count"
        case serviceQualityScore = "service_quality_score"
        case periods
        case components
    }
}
