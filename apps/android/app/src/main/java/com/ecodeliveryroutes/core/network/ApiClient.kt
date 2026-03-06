package com.ecodeliveryroutes.core.network

import com.ecodeliveryroutes.BuildConfig
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

    private fun authedGet(url: String): String {
        return executeWithRefresh("GET", url, null)
    }

    private fun authedPost(url: String, payload: JSONObject): String {
        return executeWithRefresh("POST", url, payload)
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
