package com.ecodeliveryroutes.core.model

data class RouteAssignmentMessage(
    val field: String,
    val message: String,
    val code: String? = null,
)

data class RouteAssignmentPreview(
    val valid: Boolean,
    val conflicts: List<RouteAssignmentMessage>,
    val warnings: List<RouteAssignmentMessage>,
    val recommendedSubcontractorId: String? = null,
)

data class RouteAssignmentPublishPolicy(
    val enforceOnPublish: Boolean,
    val criticalWarningCodes: List<String>,
    val bypassRoleCodes: List<String>,
)

