package com.ecodeliveryroutes.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ecodeliveryroutes.features.auth.LoginScreen
import com.ecodeliveryroutes.features.driver.DriverRouteScreen
import com.ecodeliveryroutes.features.quality.RouteQualityScreen

@Composable
fun AppNavHost() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "login") {
        composable("login") { LoginScreen(onSuccess = { navController.navigate("driver_route") }) }
        composable("driver_route") {
            DriverRouteScreen(onOpenRouteQuality = { routeId ->
                navController.navigate("route_quality/$routeId")
            })
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
