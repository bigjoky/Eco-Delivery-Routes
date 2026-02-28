package com.ecodeliveryroutes.core.model

data class QualitySnapshot(
    val id: String,
    val scopeType: String,
    val scopeId: String,
    val scopeLabel: String,
    val serviceQualityScore: Double,
    val periodStart: String,
    val periodEnd: String,
    val assignedWithAttempt: Int,
    val deliveredCompleted: Int,
    val pickupsCompleted: Int
)
