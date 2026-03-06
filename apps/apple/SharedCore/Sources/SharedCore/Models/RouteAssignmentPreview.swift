import Foundation

public struct RouteAssignmentMessage: Codable, Hashable {
    public let field: String
    public let message: String
    public let code: String?
}

public struct RouteAssignmentPreview: Codable, Hashable {
    public let valid: Bool
    public let conflicts: [RouteAssignmentMessage]
    public let warnings: [RouteAssignmentMessage]
    public let recommendedSubcontractorId: String?

    enum CodingKeys: String, CodingKey {
        case valid
        case conflicts
        case warnings
        case recommendedSubcontractorId = "recommended_subcontractor_id"
    }
}

public struct RouteAssignmentPublishPolicy: Codable, Hashable {
    public let enforceOnPublish: Bool
    public let criticalWarningCodes: [String]
    public let bypassRoleCodes: [String]

    enum CodingKeys: String, CodingKey {
        case enforceOnPublish = "enforce_on_publish"
        case criticalWarningCodes = "critical_warning_codes"
        case bypassRoleCodes = "bypass_role_codes"
    }
}

