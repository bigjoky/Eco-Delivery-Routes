import Foundation

public struct Role: Codable, Identifiable {
    public let id: String
    public let code: String
    public let name: String

    public init(id: String, code: String, name: String) {
        self.id = id
        self.code = code
        self.name = name
    }
}
