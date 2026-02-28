package com.ecodeliveryroutes.core.model

data class QualityBreakdown(
    val scopeId: String,
    val scopeLabel: String,
    val granularity: String,
    val serviceQualityScore: Double,
    val components: QualityBreakdownComponents,
    val periods: List<QualityBreakdownPeriod>
)

data class QualityBreakdownComponents(
    val assignedWithAttempt: Int,
    val deliveredCompleted: Int,
    val pickupsCompleted: Int,
    val failedCount: Int,
    val absentCount: Int,
    val retryCount: Int,
    val completedTotal: Int,
    val completionRatio: Double
)

data class QualityBreakdownPeriod(
    val periodKey: String,
    val periodStart: String,
    val periodEnd: String,
    val completionRatio: Double,
    val completedTotal: Int,
    val assignedWithAttempt: Int
)
