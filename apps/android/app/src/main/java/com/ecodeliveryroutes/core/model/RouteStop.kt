package com.ecodeliveryroutes.core.model

data class RouteStop(
    val id: String,
    val sequence: Int,
    val stopType: String,
    val entityType: String,
    val entityId: String,
    val reference: String,
    val status: String
)
