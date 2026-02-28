import Foundation

public struct DriverStop: Codable, Identifiable {
    public let id: String
    public let sequence: Int
    public let stopType: String
    public let entityType: String
    public let entityId: String
    public let reference: String
    public let status: String

    public init(id: String, sequence: Int, stopType: String, entityType: String, entityId: String, reference: String, status: String) {
        self.id = id
        self.sequence = sequence
        self.stopType = stopType
        self.entityType = entityType
        self.entityId = entityId
        self.reference = reference
        self.status = status
    }
}

public struct DriverRouteMePayload: Codable {
    public let driver: DriverIdentity?
    public let route: DriverRouteIdentity?
    public let stops: [DriverStop]

    public init(driver: DriverIdentity?, route: DriverRouteIdentity?, stops: [DriverStop]) {
        self.driver = driver
        self.route = route
        self.stops = stops
    }
}

public struct DriverIdentity: Codable {
    public let id: String
    public let code: String
    public let name: String
}

public struct DriverRouteIdentity: Codable {
    public let id: String
    public let code: String
    public let routeDate: String
    public let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case code
        case routeDate = "route_date"
        case status
    }
}
