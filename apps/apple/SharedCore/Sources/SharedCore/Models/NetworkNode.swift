import Foundation

public struct HubSummary: Codable, Identifiable {
    public let id: String
    public let code: String
    public let name: String
    public let city: String?
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case code
        case name
        case city
        case isActive = "is_active"
    }
}

public struct DepotSummary: Codable, Identifiable {
    public let id: String
    public let hubId: String
    public let code: String
    public let name: String
    public let addressLine: String?
    public let city: String?
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case hubId = "hub_id"
        case code
        case name
        case addressLine = "address_line"
        case city
        case isActive = "is_active"
    }
}

public struct PointSummary: Codable, Identifiable {
    public let id: String
    public let hubId: String
    public let depotId: String?
    public let code: String
    public let name: String
    public let addressLine: String?
    public let city: String?
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case hubId = "hub_id"
        case depotId = "depot_id"
        case code
        case name
        case addressLine = "address_line"
        case city
        case isActive = "is_active"
    }
}
