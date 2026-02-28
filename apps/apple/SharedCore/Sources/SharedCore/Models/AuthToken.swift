import Foundation

public struct AuthToken: Codable {
    public let token: String
    public let tokenType: String

    public init(token: String, tokenType: String = "Bearer") {
        self.token = token
        self.tokenType = tokenType
    }
}
