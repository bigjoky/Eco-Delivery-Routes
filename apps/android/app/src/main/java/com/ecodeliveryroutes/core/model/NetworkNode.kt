package com.ecodeliveryroutes.core.model

data class HubSummary(
    val id: String,
    val code: String,
    val name: String,
    val city: String?,
    val isActive: Boolean
)

data class DepotSummary(
    val id: String,
    val hubId: String,
    val code: String,
    val name: String,
    val city: String?,
    val isActive: Boolean
)

data class PointSummary(
    val id: String,
    val hubId: String,
    val depotId: String?,
    val code: String,
    val name: String,
    val city: String?,
    val isActive: Boolean
)
