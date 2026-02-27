import SwiftUI
import SharedCore

@main
struct WarehouseTVApp: App {
    var body: some Scene {
        WindowGroup {
            TVDashboardView()
        }
    }
}

struct TVDashboardView: View {
    var body: some View {
        VStack(spacing: 24) {
            Text("Eco Delivery Routes")
                .font(.largeTitle)
            Text("Modo Monitor (solo lectura)")
        }
        .padding()
    }
}
