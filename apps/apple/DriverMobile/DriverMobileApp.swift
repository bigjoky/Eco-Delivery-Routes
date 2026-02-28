import SwiftUI
import SharedCore

@main
struct DriverMobileApp: App {
    var body: some Scene {
        WindowGroup {
            MobileRootView()
        }
    }
}

struct MobileRootView: View {
    var body: some View {
        TabView {
            Text("Login")
                .tabItem { Label("Auth", systemImage: "person.crop.circle") }
            Text("Perfil")
                .tabItem { Label("Perfil", systemImage: "person") }
        }
    }
}
