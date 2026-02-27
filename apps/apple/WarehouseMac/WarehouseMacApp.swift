import SwiftUI
import SharedCore

@main
struct WarehouseMacApp: App {
    var body: some Scene {
        WindowGroup {
            MacRootView()
        }
    }
}

struct MacRootView: View {
    var body: some View {
        NavigationSplitView {
            List {
                NavigationLink("Login", value: "login")
                NavigationLink("Usuarios", value: "users")
            }
        } detail: {
            Text("Eco Delivery Routes macOS")
        }
    }
}
