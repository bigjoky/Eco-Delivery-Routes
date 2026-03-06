package com.ecodeliveryroutes.core.model

data class HubSummary(
    val id: String,
    val code: String,
    val name: String,
    val city: String?,
    val isActive: Boolean,
    val deletedAt: String? = null
)

data class DepotSummary(
    val id: String,
    val hubId: String,
    val code: String,
    val name: String,
    val city: String?,
    val isActive: Boolean,
    val deletedAt: String? = null
)

data class PointSummary(
    val id: String,
    val hubId: String,
    val depotId: String?,
    val code: String,
    val name: String,
    val city: String?,
    val isActive: Boolean,
    val deletedAt: String? = null
)
