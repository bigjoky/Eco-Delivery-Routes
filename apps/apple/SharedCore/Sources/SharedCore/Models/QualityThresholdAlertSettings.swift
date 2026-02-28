import Foundation

public struct QualityThresholdAlertSettings: Codable {
    public let largeDeltaThreshold: Double
    public let windowHours: Int
    public let canManage: Bool?
    public let sourceType: String?

    enum CodingKeys: String, CodingKey {
        case largeDeltaThreshold = "large_delta_threshold"
        case windowHours = "window_hours"
        case canManage = "can_manage"
        case sourceType = "source_type"
    }

    public init(largeDeltaThreshold: Double, windowHours: Int, canManage: Bool?, sourceType: String?) {
        self.largeDeltaThreshold = largeDeltaThreshold
        self.windowHours = windowHours
        self.canManage = canManage
        self.sourceType = sourceType
    }
}
