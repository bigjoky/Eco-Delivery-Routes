import Foundation

public struct DashboardOverview: Codable {
    public let period: DashboardPeriod
    public let totals: DashboardTotals
    public let shipmentsByStatus: DashboardShipmentsByStatus
    public let routesByStatus: DashboardRoutesByStatus
    public let quality: DashboardQuality
    public let sla: DashboardSLA
    public let alerts: [DashboardAlert]

    enum CodingKeys: String, CodingKey {
        case period
        case totals
        case shipmentsByStatus = "shipments_by_status"
        case routesByStatus = "routes_by_status"
        case quality
        case sla
        case alerts
    }
}

public struct DashboardPeriod: Codable {
    public let from: String
    public let to: String
    public let preset: String
}

public struct DashboardTotals: Codable {
    public let shipments: Int
    public let routes: Int
    public let incidentsOpen: Int
    public let qualityThreshold: Double

    enum CodingKeys: String, CodingKey {
        case shipments
        case routes
        case incidentsOpen = "incidents_open"
        case qualityThreshold = "quality_threshold"
    }
}

public struct DashboardShipmentsByStatus: Codable {
    public let created: Int
    public let outForDelivery: Int
    public let delivered: Int
    public let incident: Int

    enum CodingKeys: String, CodingKey {
        case created
        case outForDelivery = "out_for_delivery"
        case delivered
        case incident
    }
}

public struct DashboardRoutesByStatus: Codable {
    public let planned: Int
    public let inProgress: Int
    public let completed: Int

    enum CodingKeys: String, CodingKey {
        case planned
        case inProgress = "in_progress"
        case completed
    }
}

public struct DashboardQuality: Codable {
    public let routeAvg: Double
    public let driverAvg: Double
    public let belowThresholdRoutes: Int

    enum CodingKeys: String, CodingKey {
        case routeAvg = "route_avg"
        case driverAvg = "driver_avg"
        case belowThresholdRoutes = "below_threshold_routes"
    }
}

public struct DashboardSLA: Codable {
    public let onTrack: Int
    public let atRisk: Int
    public let breached: Int
    public let resolved: Int

    enum CodingKeys: String, CodingKey {
        case onTrack = "on_track"
        case atRisk = "at_risk"
        case breached
        case resolved
    }
}

public struct DashboardAlert: Codable, Identifiable {
    public let id: String
    public let severity: String
    public let title: String
    public let message: String
    public let href: String
    public let count: Int
}
