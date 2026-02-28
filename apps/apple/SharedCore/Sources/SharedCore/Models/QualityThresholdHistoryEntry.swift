import Foundation

public struct QualityThresholdHistoryEntry: Codable, Identifiable {
    public let id: Int
    public let event: String
    public let actorUserId: String?
    public let actorName: String?
    public let createdAt: String
    public let scopeType: String?
    public let scopeId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case event
        case actorUserId = "actor_user_id"
        case actorName = "actor_name"
        case createdAt = "created_at"
        case scopeType = "scope_type"
        case scopeId = "scope_id"
    }

    public init(
        id: Int,
        event: String,
        actorUserId: String?,
        actorName: String?,
        createdAt: String,
        scopeType: String?,
        scopeId: String?
    ) {
        self.id = id
        self.event = event
        self.actorUserId = actorUserId
        self.actorName = actorName
        self.createdAt = createdAt
        self.scopeType = scopeType
        self.scopeId = scopeId
    }
}
