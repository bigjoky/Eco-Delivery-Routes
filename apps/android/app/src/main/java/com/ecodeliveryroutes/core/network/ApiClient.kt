package com.ecodeliveryroutes.core.network

import com.ecodeliveryroutes.BuildConfig
import com.ecodeliveryroutes.core.model.AuthProfile
import com.ecodeliveryroutes.core.model.DashboardAlert
import com.ecodeliveryroutes.core.model.DashboardOverview
import com.ecodeliveryroutes.core.model.DepotSummary
import com.ecodeliveryroutes.core.model.HubSummary
import com.ecodeliveryroutes.core.model.PointSummary
import com.ecodeliveryroutes.core.model.QualityBreakdown
import com.ecodeliveryroutes.core.model.QualityBreakdownComponents
import com.ecodeliveryroutes.core.model.QualityBreakdownPeriod
import com.ecodeliveryroutes.core.model.RouteAssignmentMessage
import com.ecodeliveryroutes.core.model.RouteAssignmentPreview
import com.ecodeliveryroutes.core.model.RouteAssignmentPublishPolicy
import com.ecodeliveryroutes.core.model.QualitySnapshot
import com.ecodeliveryroutes.core.model.RouteStop
import com.ecodeliveryroutes.core.session.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(private val baseUrl: String? = BuildConfig.API_BASE_URL.takeIf { it.isNotBlank() }) {
    suspend fun login(email: String, password: String): String = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext "mock-token"

        runCatching {
            val connection = (URL("$baseUrl/auth/login").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }

            val payload = JSONObject().put("email", email).put("password", password).put("device_name", "android-driver").toString()
            connection.outputStream.use { it.write(payload.toByteArray()) }
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            JSONObject(body).optString("token", "mock-token")
        }.getOrDefault("mock-token")
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext
        runCatching {
            val connection = (URL("$baseUrl/auth/logout").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                SessionStore.token?.let { setRequestProperty("Authorization", "Bearer $it") }
            }
            connection.inputStream.bufferedReader().use { it.readText() }
        }
    }

    suspend fun me(): AuthProfile? = withContext(Dispatchers.IO) {
        if (baseUrl == null) {
            return@withContext AuthProfile(
                id = "u-mock-1",
                name = "Admin Demo",
                email = "admin@eco.local",
                status = "active",
                roleCodes = listOf("super_admin")
            )
        }
        runCatching {
            val payload = authedGet("$baseUrl/auth/me")
            val data = JSONObject(payload).optJSONObject("data") ?: return@runCatching null
            val roles = data.optJSONArray("roles") ?: JSONArray()
            val roleCodes = (0 until roles.length()).mapNotNull { index ->
                roles.optJSONObject(index)?.optString("code")?.ifBlank { null }
            }
            AuthProfile(
                id = data.optString("id"),
                name = data.optString("name"),
                email = data.optString("email"),
                status = data.optString("status"),
                roleCodes = roleCodes
            )
        }.getOrNull()
    }

    suspend fun myRouteStops(routeDate: String? = null, status: String? = null): List<RouteStop> = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext mockRouteStops()

        runCatching {
            val query = buildList {
                if (!routeDate.isNullOrBlank()) add("route_date=$routeDate")
                if (!status.isNullOrBlank()) add("status=$status")
            }.joinToString("&")
            val suffix = if (query.isNotEmpty()) "?$query" else ""
            val payload = authedGet("$baseUrl/driver/me/route$suffix")
            val stops = JSONObject(payload).optJSONObject("data")?.optJSONArray("stops") ?: JSONArray()
            parseRouteStops(stops)
        }.getOrDefault(mockRouteStops())
    }

    suspend fun registerScan(trackableType: String, trackableId: String, scanCode: String): Boolean =
        withContext(Dispatchers.IO) {
            if (baseUrl == null) return@withContext true
            runCatching {
                authedPost(
                    "$baseUrl/tracking-events",
                    JSONObject()
                        .put("trackable_type", trackableType)
                        .put("trackable_id", trackableId)
                        .put("event_code", "SCAN")
                        .put("scan_code", scanCode)
                        .put("occurred_at", java.time.Instant.now().toString())
                )
                true
            }.getOrDefault(false)
        }

    suspend fun registerPod(evidenceType: String, evidenceId: String, signatureName: String): Boolean =
        withContext(Dispatchers.IO) {
            if (baseUrl == null) return@withContext true
            runCatching {
                authedPost(
                    "$baseUrl/pods",
                    JSONObject()
                        .put("evidenceable_type", evidenceType)
                        .put("evidenceable_id", evidenceId)
                        .put("signature_name", signatureName)
                )
                true
            }.getOrDefault(false)
        }

    suspend fun createPickup(reference: String, pickupType: String, hubId: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedPost(
                "$baseUrl/pickups",
                JSONObject()
                    .put("hub_id", hubId)
                    .put("reference", reference)
                    .put("pickup_type", pickupType)
            )
            true
        }.getOrDefault(false)
    }

    suspend fun createShipment(
        hubId: String,
        consigneeName: String,
        consigneeDocumentId: String,
        consigneePhone: String,
        senderName: String,
        senderDocumentId: String,
        senderPhone: String,
        scheduledAt: String? = null,
        serviceType: String = "express_1030"
    ): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedPost(
                "$baseUrl/shipments",
                JSONObject()
                    .put("hub_id", hubId)
                    .put("consignee_name", consigneeName)
                    .put("consignee_document_id", consigneeDocumentId)
                    .put("consignee_phone", consigneePhone)
                    .put("sender_name", senderName)
                    .put("sender_document_id", senderDocumentId)
                    .put("sender_phone", senderPhone)
                    .put("scheduled_at", scheduledAt ?: java.time.LocalDate.now().toString())
                    .put("service_type", serviceType)
            )
            true
        }.getOrDefault(false)
    }

    suspend fun registerIncident(
        incidentableType: String,
        incidentableId: String,
        catalogCode: String,
        category: String,
        notes: String
    ): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedPost(
                "$baseUrl/incidents",
                JSONObject()
                    .put("incidentable_type", incidentableType)
                    .put("incidentable_id", incidentableId)
                    .put("catalog_code", catalogCode)
                    .put("category", category)
                    .put("notes", notes)
            )
            true
        }.getOrDefault(false)
    }

    suspend fun qualityRouteSnapshots(): List<QualitySnapshot> = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext mockQualityRouteSnapshots()

        runCatching {
            val payload = authedGet("$baseUrl/kpis/quality?scope_type=route")
            val rows = JSONObject(payload).optJSONArray("data") ?: JSONArray()
            (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                QualitySnapshot(
                    id = item.optString("id"),
                    scopeType = item.optString("scope_type"),
                    scopeId = item.optString("scope_id"),
                    scopeLabel = item.optString("scope_label").ifBlank { item.optString("scope_id") },
                    serviceQualityScore = item.optDouble("service_quality_score"),
                    periodStart = item.optString("period_start"),
                    periodEnd = item.optString("period_end"),
                    assignedWithAttempt = item.optInt("assigned_with_attempt"),
                    deliveredCompleted = item.optInt("delivered_completed"),
                    pickupsCompleted = item.optInt("pickups_completed")
                )
            }
        }.getOrDefault(mockQualityRouteSnapshots())
    }

    suspend fun dashboardOverview(
        period: String = "7d",
        hubId: String? = null,
        subcontractorId: String? = null
    ): DashboardOverview = withContext(Dispatchers.IO) {
        if (baseUrl == null) {
            return@withContext DashboardOverview(
                periodFrom = "2026-03-01",
                periodTo = "2026-03-08",
                shipments = 124,
                routes = 18,
                incidentsOpen = 7,
                qualityThreshold = 95.0,
                routeQualityAvg = 94.7,
                alerts = listOf(
                    DashboardAlert("incidents-open", "high", "Incidencias abiertas", "Hay incidencias pendientes.", "/incidents?resolved=open", 7),
                    DashboardAlert("quality-below-threshold", "medium", "Rutas bajo umbral", "Revisar KPI por ruta.", "/quality?scopeType=route", 5)
                ),
                shipmentTrend = listOf(12, 15, 18, 16, 20, 19, 17),
                routeTrend = listOf(4, 5, 3, 6, 5, 7, 6),
                incidentTrend = listOf(3, 2, 4, 3, 2, 3, 1)
            )
        }

        runCatching {
            val query = buildList {
                add("period=$period")
                if (!hubId.isNullOrBlank()) add("hub_id=$hubId")
                if (!subcontractorId.isNullOrBlank()) add("subcontractor_id=$subcontractorId")
            }.joinToString("&")
            val payload = authedGet("$baseUrl/dashboard/overview?$query")
            val data = JSONObject(payload).optJSONObject("data") ?: JSONObject()
            val periodObj = data.optJSONObject("period") ?: JSONObject()
            val totalsObj = data.optJSONObject("totals") ?: JSONObject()
            val qualityObj = data.optJSONObject("quality") ?: JSONObject()
            val alerts = data.optJSONArray("alerts") ?: JSONArray()
            val trends = data.optJSONObject("trends") ?: JSONObject()
            val shipmentTrend = trends.optJSONArray("shipments") ?: JSONArray()
            val routeTrend = trends.optJSONArray("routes") ?: JSONArray()
            val incidentTrend = trends.optJSONArray("incidents") ?: JSONArray()

            DashboardOverview(
                periodFrom = periodObj.optString("from"),
                periodTo = periodObj.optString("to"),
                shipments = totalsObj.optInt("shipments"),
                routes = totalsObj.optInt("routes"),
                incidentsOpen = totalsObj.optInt("incidents_open"),
                qualityThreshold = totalsObj.optDouble("quality_threshold"),
                routeQualityAvg = qualityObj.optDouble("route_avg"),
                alerts = (0 until alerts.length()).map { index ->
                    val item = alerts.optJSONObject(index) ?: JSONObject()
                    DashboardAlert(
                        id = item.optString("id"),
                        severity = item.optString("severity"),
                        title = item.optString("title"),
                        message = item.optString("message"),
                        href = item.optString("href"),
                        count = item.optInt("count")
                    )
                },
                shipmentTrend = (0 until shipmentTrend.length()).map { index ->
                    shipmentTrend.optJSONObject(index)?.optInt("total") ?: 0
                },
                routeTrend = (0 until routeTrend.length()).map { index ->
                    routeTrend.optJSONObject(index)?.optInt("total") ?: 0
                },
                incidentTrend = (0 until incidentTrend.length()).map { index ->
                    incidentTrend.optJSONObject(index)?.optInt("open") ?: 0
                }
            )
        }.getOrElse {
            DashboardOverview(
                periodFrom = "",
                periodTo = "",
                shipments = 0,
                routes = 0,
                incidentsOpen = 0,
                qualityThreshold = 95.0,
                routeQualityAvg = 0.0,
                alerts = emptyList(),
                shipmentTrend = emptyList(),
                routeTrend = emptyList(),
                incidentTrend = emptyList()
            )
        }
    }

    suspend fun qualityRouteBreakdown(routeId: String, granularity: String = "month"): QualityBreakdown = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext mockQualityRouteBreakdown(routeId, granularity)

        runCatching {
            val payload = authedGet("$baseUrl/kpis/quality/routes/$routeId/breakdown?granularity=$granularity")
            val data = JSONObject(payload).optJSONObject("data") ?: return@runCatching mockQualityRouteBreakdown(routeId, granularity)
            val components = data.optJSONObject("components") ?: JSONObject()
            val periodsJson = data.optJSONArray("periods") ?: JSONArray()

            val periods = (0 until periodsJson.length()).map { index ->
                val item = periodsJson.getJSONObject(index)
                val periodComponents = item.optJSONObject("components") ?: JSONObject()
                QualityBreakdownPeriod(
                    periodKey = item.optString("period_key"),
                    periodStart = item.optString("period_start"),
                    periodEnd = item.optString("period_end"),
                    completionRatio = periodComponents.optDouble("completion_ratio"),
                    completedTotal = periodComponents.optInt("completed_total"),
                    assignedWithAttempt = periodComponents.optInt("assigned_with_attempt")
                )
            }

            QualityBreakdown(
                scopeId = data.optString("scope_id").ifBlank { routeId },
                scopeLabel = data.optString("scope_label").ifBlank { routeId },
                granularity = data.optString("granularity").ifBlank { granularity },
                serviceQualityScore = data.optDouble("service_quality_score"),
                components = QualityBreakdownComponents(
                    assignedWithAttempt = components.optInt("assigned_with_attempt"),
                    deliveredCompleted = components.optInt("delivered_completed"),
                    pickupsCompleted = components.optInt("pickups_completed"),
                    failedCount = components.optInt("failed_count"),
                    absentCount = components.optInt("absent_count"),
                    retryCount = components.optInt("retry_count"),
                    completedTotal = components.optInt("completed_total"),
                    completionRatio = components.optDouble("completion_ratio")
                ),
                periods = periods
            )
        }.getOrDefault(mockQualityRouteBreakdown(routeId, granularity))
    }

    suspend fun previewRouteAssignment(
        subcontractorId: String? = null,
        driverId: String? = null,
        vehicleId: String? = null,
        routeId: String? = null,
        routeDate: String? = null
    ): RouteAssignmentPreview = withContext(Dispatchers.IO) {
        if (baseUrl == null) {
            return@withContext RouteAssignmentPreview(
                valid = true,
                conflicts = emptyList(),
                warnings = emptyList(),
                recommendedSubcontractorId = subcontractorId
            )
        }
        runCatching {
            val query = buildList {
                if (!subcontractorId.isNullOrBlank()) add("subcontractor_id=$subcontractorId")
                if (!driverId.isNullOrBlank()) add("driver_id=$driverId")
                if (!vehicleId.isNullOrBlank()) add("vehicle_id=$vehicleId")
                if (!routeId.isNullOrBlank()) add("route_id=$routeId")
                if (!routeDate.isNullOrBlank()) add("route_date=$routeDate")
            }.joinToString("&")
            val suffix = if (query.isNotBlank()) "?$query" else ""
            val payload = authedGet("$baseUrl/routes/assignment/preview$suffix")
            val data = JSONObject(payload).optJSONObject("data") ?: JSONObject()
            val parseMessages = { key: String ->
                val array = data.optJSONArray(key) ?: JSONArray()
                (0 until array.length()).map { index ->
                    val item = array.optJSONObject(index) ?: JSONObject()
                    RouteAssignmentMessage(
                        field = item.optString("field"),
                        message = item.optString("message"),
                        code = item.optString("code").ifBlank { null }
                    )
                }
            }
            RouteAssignmentPreview(
                valid = data.optBoolean("valid", false),
                conflicts = parseMessages("conflicts"),
                warnings = parseMessages("warnings"),
                recommendedSubcontractorId = data.optString("recommended_subcontractor_id").ifBlank { null }
            )
        }.getOrElse {
            RouteAssignmentPreview(valid = false, conflicts = listOf(RouteAssignmentMessage("vehicle_id", "Cannot preview route assignment.")), warnings = emptyList())
        }
    }

    suspend fun routeAssignmentPublishPolicy(): RouteAssignmentPublishPolicy = withContext(Dispatchers.IO) {
        if (baseUrl == null) {
            return@withContext RouteAssignmentPublishPolicy(
                enforceOnPublish = true,
                criticalWarningCodes = listOf("LOW_DRIVER_QUALITY", "LOW_SUBCONTRACTOR_QUALITY"),
                bypassRoleCodes = listOf("super_admin")
            )
        }
        runCatching {
            val payload = authedGet("$baseUrl/routes/assignment/publish-policy")
            val data = JSONObject(payload).optJSONObject("data") ?: JSONObject()
            val criticalCodesJson = data.optJSONArray("critical_warning_codes") ?: JSONArray()
            val bypassRolesJson = data.optJSONArray("bypass_role_codes") ?: JSONArray()
            RouteAssignmentPublishPolicy(
                enforceOnPublish = data.optBoolean("enforce_on_publish", true),
                criticalWarningCodes = (0 until criticalCodesJson.length()).map { criticalCodesJson.optString(it) }.filter { it.isNotBlank() },
                bypassRoleCodes = (0 until bypassRolesJson.length()).map { bypassRolesJson.optString(it) }.filter { it.isNotBlank() }
            )
        }.getOrElse {
            RouteAssignmentPublishPolicy(true, listOf("LOW_DRIVER_QUALITY", "LOW_SUBCONTRACTOR_QUALITY"), listOf("super_admin"))
        }
    }

    suspend fun hubs(onlyActive: Boolean = true, includeDeleted: Boolean = false): List<HubSummary> = withContext(Dispatchers.IO) {
        if (baseUrl == null) {
            return@withContext listOf(
                HubSummary("hub-1", "AGP-HUB-01", "Hub Malaga Centro", "Malaga", true, null),
                HubSummary("hub-2", "SEV-HUB-01", "Hub Sevilla Norte", "Sevilla", true, null)
            )
        }
        runCatching {
            val suffix = "?only_active=${if (onlyActive) "1" else "0"}&include_deleted=${if (includeDeleted) "1" else "0"}"
            val payload = authedGet("$baseUrl/hubs$suffix")
            val rows = JSONObject(payload).optJSONArray("data") ?: JSONArray()
            (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                HubSummary(
                    id = item.optString("id"),
                    code = item.optString("code"),
                    name = item.optString("name"),
                    city = item.optString("city").ifBlank { null },
                    isActive = item.optBoolean("is_active", true),
                    deletedAt = item.optString("deleted_at").ifBlank { null }
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun depots(hubId: String? = null, includeDeleted: Boolean = false): List<DepotSummary> = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext emptyList()
        runCatching {
            val suffix = buildList {
                if (!hubId.isNullOrBlank()) add("hub_id=$hubId")
                add("include_deleted=${if (includeDeleted) "1" else "0"}")
            }.joinToString("&", prefix = "?")
            val payload = authedGet("$baseUrl/depots$suffix")
            val rows = JSONObject(payload).optJSONArray("data") ?: JSONArray()
            (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                DepotSummary(
                    id = item.optString("id"),
                    hubId = item.optString("hub_id"),
                    code = item.optString("code"),
                    name = item.optString("name"),
                    city = item.optString("city").ifBlank { null },
                    isActive = item.optBoolean("is_active", true),
                    deletedAt = item.optString("deleted_at").ifBlank { null }
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun points(hubId: String? = null, depotId: String? = null, includeDeleted: Boolean = false): List<PointSummary> = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext emptyList()
        runCatching {
            val query = buildList {
                if (!hubId.isNullOrBlank()) add("hub_id=$hubId")
                if (!depotId.isNullOrBlank()) add("depot_id=$depotId")
                add("include_deleted=${if (includeDeleted) "1" else "0"}")
            }.joinToString("&")
            val suffix = if (query.isNotBlank()) "?$query" else ""
            val payload = authedGet("$baseUrl/points$suffix")
            val rows = JSONObject(payload).optJSONArray("data") ?: JSONArray()
            (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                PointSummary(
                    id = item.optString("id"),
                    hubId = item.optString("hub_id"),
                    depotId = item.optString("depot_id").ifBlank { null },
                    code = item.optString("code"),
                    name = item.optString("name"),
                    city = item.optString("city").ifBlank { null },
                    isActive = item.optBoolean("is_active", true),
                    deletedAt = item.optString("deleted_at").ifBlank { null }
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun restoreHub(id: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedPost("$baseUrl/hubs/$id/restore", JSONObject())
            true
        }.getOrDefault(false)
    }

    suspend fun restoreDepot(id: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedPost("$baseUrl/depots/$id/restore", JSONObject())
            true
        }.getOrDefault(false)
    }

    suspend fun restorePoint(id: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedPost("$baseUrl/points/$id/restore", JSONObject())
            true
        }.getOrDefault(false)
    }

    suspend fun createHub(name: String, city: String, code: String? = null): HubSummary? = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext HubSummary("hub-mock", code ?: "HUB-MOCK", name, city, true, null)
        runCatching {
            val payload = JSONObject()
                .put("name", name)
                .put("city", city)
                .put("is_active", true)
            if (!code.isNullOrBlank()) payload.put("code", code)
            val raw = authedPost("$baseUrl/hubs", payload)
            val item = JSONObject(raw).optJSONObject("data") ?: return@runCatching null
            HubSummary(
                id = item.optString("id"),
                code = item.optString("code"),
                name = item.optString("name"),
                city = item.optString("city").ifBlank { null },
                isActive = item.optBoolean("is_active", true),
                deletedAt = item.optString("deleted_at").ifBlank { null }
            )
        }.getOrNull()
    }

    suspend fun updateHub(id: String, name: String, city: String?): HubSummary? = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext HubSummary(id, "HUB-MOCK", name, city, true, null)
        runCatching {
            val payload = JSONObject().put("name", name)
            if (city != null) payload.put("city", city) else payload.put("city", JSONObject.NULL)
            val raw = authedPatch("$baseUrl/hubs/$id", payload)
            val item = JSONObject(raw).optJSONObject("data") ?: return@runCatching null
            HubSummary(
                id = item.optString("id"),
                code = item.optString("code"),
                name = item.optString("name"),
                city = item.optString("city").ifBlank { null },
                isActive = item.optBoolean("is_active", true),
                deletedAt = item.optString("deleted_at").ifBlank { null }
            )
        }.getOrNull()
    }

    suspend fun createDepot(hubId: String, name: String, city: String? = null, code: String? = null): DepotSummary? = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext null
        runCatching {
            val payload = JSONObject()
                .put("hub_id", hubId)
                .put("name", name)
                .put("is_active", true)
            if (!city.isNullOrBlank()) payload.put("city", city)
            if (!code.isNullOrBlank()) payload.put("code", code)
            val raw = authedPost("$baseUrl/depots", payload)
            val item = JSONObject(raw).optJSONObject("data") ?: return@runCatching null
            DepotSummary(
                id = item.optString("id"),
                hubId = item.optString("hub_id"),
                code = item.optString("code"),
                name = item.optString("name"),
                city = item.optString("city").ifBlank { null },
                isActive = item.optBoolean("is_active", true),
                deletedAt = item.optString("deleted_at").ifBlank { null }
            )
        }.getOrNull()
    }

    suspend fun updateDepot(id: String, name: String, city: String?): DepotSummary? = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext null
        runCatching {
            val payload = JSONObject().put("name", name)
            if (city != null) payload.put("city", city) else payload.put("city", JSONObject.NULL)
            val raw = authedPatch("$baseUrl/depots/$id", payload)
            val item = JSONObject(raw).optJSONObject("data") ?: return@runCatching null
            DepotSummary(
                id = item.optString("id"),
                hubId = item.optString("hub_id"),
                code = item.optString("code"),
                name = item.optString("name"),
                city = item.optString("city").ifBlank { null },
                isActive = item.optBoolean("is_active", true),
                deletedAt = item.optString("deleted_at").ifBlank { null }
            )
        }.getOrNull()
    }

    suspend fun createPoint(
        hubId: String,
        depotId: String? = null,
        name: String,
        city: String? = null,
        code: String? = null
    ): PointSummary? = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext null
        runCatching {
            val payload = JSONObject()
                .put("hub_id", hubId)
                .put("name", name)
                .put("is_active", true)
            if (!depotId.isNullOrBlank()) payload.put("depot_id", depotId)
            if (!city.isNullOrBlank()) payload.put("city", city)
            if (!code.isNullOrBlank()) payload.put("code", code)
            val raw = authedPost("$baseUrl/points", payload)
            val item = JSONObject(raw).optJSONObject("data") ?: return@runCatching null
            PointSummary(
                id = item.optString("id"),
                hubId = item.optString("hub_id"),
                depotId = item.optString("depot_id").ifBlank { null },
                code = item.optString("code"),
                name = item.optString("name"),
                city = item.optString("city").ifBlank { null },
                isActive = item.optBoolean("is_active", true),
                deletedAt = item.optString("deleted_at").ifBlank { null }
            )
        }.getOrNull()
    }

    suspend fun updatePoint(id: String, name: String, city: String?): PointSummary? = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext null
        runCatching {
            val payload = JSONObject().put("name", name)
            if (city != null) payload.put("city", city) else payload.put("city", JSONObject.NULL)
            val raw = authedPatch("$baseUrl/points/$id", payload)
            val item = JSONObject(raw).optJSONObject("data") ?: return@runCatching null
            PointSummary(
                id = item.optString("id"),
                hubId = item.optString("hub_id"),
                depotId = item.optString("depot_id").ifBlank { null },
                code = item.optString("code"),
                name = item.optString("name"),
                city = item.optString("city").ifBlank { null },
                isActive = item.optBoolean("is_active", true),
                deletedAt = item.optString("deleted_at").ifBlank { null }
            )
        }.getOrNull()
    }

    suspend fun archiveHub(id: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedDelete("$baseUrl/hubs/$id")
            true
        }.getOrDefault(false)
    }

    suspend fun archiveDepot(id: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedDelete("$baseUrl/depots/$id")
            true
        }.getOrDefault(false)
    }

    suspend fun archivePoint(id: String): Boolean = withContext(Dispatchers.IO) {
        if (baseUrl == null) return@withContext true
        runCatching {
            authedDelete("$baseUrl/points/$id")
            true
        }.getOrDefault(false)
    }

    private fun authedGet(url: String): String {
        return executeWithRefresh("GET", url, null)
    }

    private fun authedPost(url: String, payload: JSONObject): String {
        return executeWithRefresh("POST", url, payload)
    }

    private fun authedPatch(url: String, payload: JSONObject): String {
        return executeWithRefresh("PATCH", url, payload)
    }

    private fun authedDelete(url: String): String {
        return executeWithRefresh("DELETE", url, null)
    }

    private fun executeWithRefresh(method: String, url: String, payload: JSONObject?): String {
        var response = execute(method, url, payload)
        if (response.statusCode == 401 && refreshToken()) {
            response = execute(method, url, payload)
        }
        if (response.statusCode in 200..299) {
            return response.body
        }
        throw IllegalStateException("HTTP ${response.statusCode}")
    }

    private fun execute(method: String, url: String, payload: JSONObject?): HttpResult {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            SessionStore.token?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (payload != null) {
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
        }
        if (payload != null) {
            connection.outputStream.use { it.write(payload.toString().toByteArray()) }
        }
        val statusCode = connection.responseCode
        val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        return HttpResult(statusCode = statusCode, body = body)
    }

    private fun refreshToken(): Boolean {
        val token = SessionStore.token ?: return false
        val baseUrl = baseUrl ?: return false
        val connection = (URL("$baseUrl/auth/refresh").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Authorization", "Bearer $token")
        }
        val code = connection.responseCode
        if (code !in 200..299) {
            SessionStore.updateToken(null)
            return false
        }
        val body = connection.inputStream.bufferedReader().use { it.readText() }
        val refreshed = JSONObject(body).optString("token")
        if (refreshed.isBlank()) {
            SessionStore.updateToken(null)
            return false
        }
        SessionStore.updateToken(refreshed)
        return true
    }

    private fun mockRouteStops(): List<RouteStop> = listOf(
        RouteStop("st-1", 1, "DELIVERY", "shipment", "00000000-0000-0000-0000-000000000101", "SHP-AGP-0001", "in_progress"),
        RouteStop("st-2", 2, "PICKUP", "pickup", "00000000-0000-0000-0000-000000000201", "PCK-AGP-0001", "planned")
    )

    private fun mockQualityRouteSnapshots(): List<QualitySnapshot> = listOf(
        QualitySnapshot(
            id = "q-route-1",
            scopeType = "route",
            scopeId = "r-1",
            scopeLabel = "R-AGP-20260227",
            serviceQualityScore = 95.6,
            periodStart = "2026-02-01",
            periodEnd = "2026-02-28",
            assignedWithAttempt = 120,
            deliveredCompleted = 112,
            pickupsCompleted = 3
        )
    )

    private fun mockQualityRouteBreakdown(routeId: String, granularity: String): QualityBreakdown {
        val components = QualityBreakdownComponents(
            assignedWithAttempt = 120,
            deliveredCompleted = 112,
            pickupsCompleted = 3,
            failedCount = 2,
            absentCount = 1,
            retryCount = 2,
            completedTotal = 115,
            completionRatio = 95.83
        )

        return QualityBreakdown(
            scopeId = routeId,
            scopeLabel = "R-AGP-20260227",
            granularity = granularity,
            serviceQualityScore = 95.83,
            components = components,
            periods = listOf(
                QualityBreakdownPeriod(
                    periodKey = if (granularity == "week") "2026-W08" else "2026-02",
                    periodStart = "2026-02-01",
                    periodEnd = "2026-02-28",
                    completionRatio = components.completionRatio,
                    completedTotal = components.completedTotal,
                    assignedWithAttempt = components.assignedWithAttempt
                )
            )
        )
    }
}

private data class HttpResult(
    val statusCode: Int,
    val body: String
)

internal fun parseRouteStops(stops: JSONArray): List<RouteStop> =
    (0 until stops.length()).map { index ->
        val item = stops.getJSONObject(index)
        val fallbackType = if (item.optString("stop_type").equals("PICKUP", ignoreCase = true)) "pickup" else "shipment"
        val entityType = item.optString("entity_type").ifBlank { fallbackType }
        val entityId = item.optString("entity_id")
            .ifBlank { item.optString("shipment_id").ifBlank { item.optString("pickup_id") } }
        val reference = item.optString("reference").ifBlank { entityId }
        RouteStop(
            id = item.optString("id"),
            sequence = item.optInt("sequence"),
            stopType = item.optString("stop_type"),
            entityType = entityType,
            entityId = entityId,
            reference = reference,
            status = item.optString("status")
        )
    }
