import Foundation

@MainActor
public final class AuthSession: ObservableObject {
    private static let tokenStorageKey = "eco_delivery_routes_auth_token"

    @Published public private(set) var token: AuthToken?

    public init(token: AuthToken? = nil) {
        if let token {
            self.token = token
            return
        }

        self.token = Self.loadStoredToken()
    }

    public func updateToken(_ token: AuthToken?) {
        self.token = token
        Self.persistToken(token)
    }

    private static func loadStoredToken() -> AuthToken? {
        guard let value = UserDefaults.standard.string(forKey: tokenStorageKey), !value.isEmpty else {
            return nil
        }

        return AuthToken(token: value)
    }

    private static func persistToken(_ token: AuthToken?) {
        if let token = token?.token, !token.isEmpty {
            UserDefaults.standard.set(token, forKey: tokenStorageKey)
        } else {
            UserDefaults.standard.removeObject(forKey: tokenStorageKey)
        }
    }
}
