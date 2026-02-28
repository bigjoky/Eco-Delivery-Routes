import Foundation

public struct QualityThresholdConfig: Codable {
    public let threshold: Double
    public let sourceType: String
    public let sourceId: String?
    public let canManage: Bool?

    enum CodingKeys: String, CodingKey {
        case threshold
        case sourceType = "source_type"
        case sourceId = "source_id"
        case canManage = "can_manage"
    }
}
