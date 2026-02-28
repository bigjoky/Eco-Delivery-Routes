//
//  EcoDeliveryRoutesMacApp.swift
//  EcoDeliveryRoutesMac
//
//  Created by Joaquin Arevalo Bueno on 27/2/26.
//

import SharedCore
import SwiftUI

@main
struct EcoDeliveryRoutesMacApp: App {
    @StateObject private var authSession = AuthSession()
    private let apiClient = APIClient(baseURL: URL(string: ProcessInfo.processInfo.environment["API_BASE_URL"] ?? ""))

    var body: some Scene {
        WindowGroup {
            ContentView(apiClient: apiClient)
                .environmentObject(authSession)
                .onAppear {
                    apiClient.setAuthToken(authSession.token?.token)
                }
        }
    }
}
