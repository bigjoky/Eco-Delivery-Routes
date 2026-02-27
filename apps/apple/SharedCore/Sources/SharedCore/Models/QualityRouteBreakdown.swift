import Foundation

public struct QualityRouteBreakdown: Codable {
    public let routeId: String
    public let routeCode: String?
    public let hubId: String?
    public let subcontractorId: String?
    public let latestSnapshotId: String?
    public let latestPeriodStart: String?
    public let latestPeriodEnd: String?
    public let snapshotsCount: Int
    public let serviceQualityScore: Double
    public let components: Components

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
        case routeId = "route_id"
        case routeCode = "route_code"
        case hubId = "hub_id"
        case subcontractorId = "subcontractor_id"
        case latestSnapshotId = "latest_snapshot_id"
        case latestPeriodStart = "latest_period_start"
        case latestPeriodEnd = "latest_period_end"
        case snapshotsCount = "snapshots_count"
        case serviceQualityScore = "service_quality_score"
        case components
    }

    public init(
        routeId: String,
        routeCode: String?,
        hubId: String?,
        subcontractorId: String?,
        latestSnapshotId: String?,
        latestPeriodStart: String?,
        latestPeriodEnd: String?,
        snapshotsCount: Int,
        serviceQualityScore: Double,
        components: Components
    ) {
        self.routeId = routeId
        self.routeCode = routeCode
        self.hubId = hubId
        self.subcontractorId = subcontractorId
        self.latestSnapshotId = latestSnapshotId
        self.latestPeriodStart = latestPeriodStart
        self.latestPeriodEnd = latestPeriodEnd
        self.snapshotsCount = snapshotsCount
        self.serviceQualityScore = serviceQualityScore
        self.components = components
    }
}
