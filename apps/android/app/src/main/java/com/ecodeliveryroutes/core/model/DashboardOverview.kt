package com.ecodeliveryroutes.core.model

data class DashboardOverview(
    val periodFrom: String,
    val periodTo: String,
    val shipments: Int,
    val routes: Int,
    val incidentsOpen: Int,
    val qualityThreshold: Double,
    val routeQualityAvg: Double,
    val alerts: List<DashboardAlert>,
    val shipmentTrend: List<Int>,
    val routeTrend: List<Int>,
    val incidentTrend: List<Int>
)

data class DashboardAlert(
    val id: String,
    val severity: String,
    val title: String,
    val message: String,
    val href: String,
    val count: Int
)
