import SwiftUI

@main
struct EcoDeliveryRoutesTVApp: App {
    private let monitorService = TVMonitorService()

    var body: some Scene {
        WindowGroup {
            ContentView(monitorService: monitorService)
        }
    }
}
