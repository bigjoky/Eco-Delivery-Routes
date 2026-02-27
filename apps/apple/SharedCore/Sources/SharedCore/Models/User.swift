import Foundation

public struct User: Codable, Identifiable {
    public let id: String
    public let name: String
    public let email: String
    public let status: String

    public init(id: String, name: String, email: String, status: String) {
        self.id = id
        self.name = name
        self.email = email
        self.status = status
    }
}
