import Foundation

public struct QualityThresholdAlertTopScope: Codable, Identifiable {
    public var id: String { "\(scopeType)|\(scopeId ?? "")" }
    public let scopeType: String
    public let scopeId: String?
    public let scopeLabel: String?
    public let alertsCount: Int

    enum CodingKeys: String, CodingKey {
        case scopeType = "scope_type"
        case scopeId = "scope_id"
        case scopeLabel = "scope_label"
        case alertsCount = "alerts_count"
    }

    public init(scopeType: String, scopeId: String?, scopeLabel: String?, alertsCount: Int) {
        self.scopeType = scopeType
        self.scopeId = scopeId
        self.scopeLabel = scopeLabel
        self.alertsCount = alertsCount
    }
}
