package com.ecodeliveryroutes.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ecodeliveryroutes.core.session.SessionStore
import com.ecodeliveryroutes.features.auth.LoginScreen
import com.ecodeliveryroutes.features.driver.DriverRouteScreen
import com.ecodeliveryroutes.features.network.NetworkNodesScreen
import com.ecodeliveryroutes.features.quality.RouteQualityScreen
import com.ecodeliveryroutes.features.shipments.ShipmentDraftScreen

@Composable
fun AppNavHost() {
    val navController = rememberNavController()
    val startDestination = if (SessionStore.isAuthenticated()) "driver_route" else "login"

    NavHost(navController = navController, startDestination = startDestination) {
        composable("login") {
            LoginScreen(onSuccess = {
                navController.navigate("driver_route") {
                    popUpTo("login") { inclusive = true }
                }
            })
        }
        composable("driver_route") {
            DriverRouteScreen(onOpenRouteQuality = { routeId ->
                navController.navigate("route_quality/$routeId")
            }, onOpenNetworkNodes = {
                navController.navigate("network_nodes")
            }, onOpenShipmentDraft = {
                navController.navigate("shipment_draft")
            }, onLogout = {
                navController.navigate("login") {
                    popUpTo("driver_route") { inclusive = true }
                }
            })
        }
        composable("shipment_draft") {
            ShipmentDraftScreen()
        }
        composable("network_nodes") {
            NetworkNodesScreen()
        }
        composable(
            route = "route_quality/{routeId}",
            arguments = listOf(navArgument("routeId") { type = NavType.StringType })
        ) { backStackEntry ->
            val routeId = backStackEntry.arguments?.getString("routeId").orEmpty()
            RouteQualityScreen(routeId = routeId)
        }
    }
}
