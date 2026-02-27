package com.ecodeliveryroutes.core.network

import com.ecodeliveryroutes.BuildConfig
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

    private fun authedGet(url: String): String {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            SessionStore.token?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        return connection.inputStream.bufferedReader().use { it.readText() }
    }

    private fun authedPost(url: String, payload: JSONObject): String {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            SessionStore.token?.let { setRequestProperty("Authorization", "Bearer $it") }
            doOutput = true
        }
        connection.outputStream.use { it.write(payload.toString().toByteArray()) }
        return connection.inputStream.bufferedReader().use { it.readText() }
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
}

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
