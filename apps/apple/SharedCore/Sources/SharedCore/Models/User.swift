import Foundation

public struct User: Codable, Identifiable {
    public let id: String
    public let name: String
    public let email: String
    public let status: String
    public let lastLoginAt: String?
    public let roles: [UserRole]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case status
        case lastLoginAt = "last_login_at"
        case roles
    }

    public init(id: String, name: String, email: String, status: String, lastLoginAt: String? = nil, roles: [UserRole] = []) {
        self.id = id
        self.name = name
        self.email = email
        self.status = status
        self.lastLoginAt = lastLoginAt
        self.roles = roles
    }
}

public struct UserRole: Codable, Identifiable {
    public let id: String
    public let code: String
    public let name: String

    public init(id: String, code: String, name: String) {
        self.id = id
        self.code = code
        self.name = name
    }
}
