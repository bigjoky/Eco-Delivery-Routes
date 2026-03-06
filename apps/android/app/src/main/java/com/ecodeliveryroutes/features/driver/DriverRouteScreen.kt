package com.ecodeliveryroutes.features.driver

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ecodeliveryroutes.core.model.QualitySnapshot
import com.ecodeliveryroutes.core.model.RouteStop
import com.ecodeliveryroutes.core.network.ApiProvider
import com.ecodeliveryroutes.core.session.SessionStore
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeParseException

@Composable
fun DriverRouteScreen(
    onOpenRouteQuality: (String) -> Unit = {},
    onOpenNetworkNodes: () -> Unit = {},
    onLogout: () -> Unit = {}
) {
    val context = LocalContext.current
    val stops = remember { mutableStateOf<List<RouteStop>>(emptyList()) }
    val selectedStopId = remember { mutableStateOf<String?>(null) }
    val routeDateFilter = remember { mutableStateOf(LocalDate.now().toString()) }
    val routeStatusFilter = remember { mutableStateOf("") }
    val routeQuality = remember { mutableStateOf<List<QualitySnapshot>>(emptyList()) }
    val scanCode = remember { mutableStateOf("") }
    val podSignature = remember { mutableStateOf("") }
    val pickupRef = remember { mutableStateOf("PCK-") }
    val incidentCode = remember { mutableStateOf("ABSENT_HOME") }
    val incidentNotes = remember { mutableStateOf("") }
    val message = remember { mutableStateOf("") }
    val canAccessNetwork = remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val prefs = context.getSharedPreferences("eco_driver_filters", android.content.Context.MODE_PRIVATE)

    LaunchedEffect(Unit) {
        routeDateFilter.value = prefs.getString("route_date", LocalDate.now().toString()) ?: LocalDate.now().toString()
        routeStatusFilter.value = prefs.getString("route_status", "") ?: ""
        pickupRef.value = prefs.getString("pickup_ref", "PCK-") ?: "PCK-"
        incidentCode.value = prefs.getString("incident_code", "ABSENT_HOME") ?: "ABSENT_HOME"
        if (!isValidRouteDate(routeDateFilter.value)) {
            routeDateFilter.value = LocalDate.now().toString()
        }
        stops.value = ApiProvider.client.myRouteStops(routeDateFilter.value, routeStatusFilter.value)
        selectedStopId.value = stops.value.firstOrNull()?.id
        routeQuality.value = ApiProvider.client.qualityRouteSnapshots()
        val profile = ApiProvider.client.me()
        val allowedRoles = setOf("super_admin", "operations_manager", "warehouse_manager", "traffic_manager")
        canAccessNetwork.value = profile?.roleCodes?.any { role -> allowedRoles.contains(role) } == true
    }

    val selectedStop = stops.value.firstOrNull { it.id == selectedStopId.value } ?: stops.value.firstOrNull()

    Column(modifier = Modifier.padding(16.dp)) {
        Text("Mi Ruta")
        OutlinedTextField(
            value = routeDateFilter.value,
            onValueChange = { routeDateFilter.value = it },
            label = { Text("Fecha ruta (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = routeStatusFilter.value,
            onValueChange = { routeStatusFilter.value = it },
            label = { Text("Estado ruta (opcional)") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = {
            if (!isValidRouteDate(routeDateFilter.value)) {
                message.value = "Fecha invalida. Usa YYYY-MM-DD."
                return@Button
            }
            scope.launch {
                prefs.edit()
                    .putString("route_date", routeDateFilter.value)
                    .putString("route_status", routeStatusFilter.value)
                    .apply()
                stops.value = ApiProvider.client.myRouteStops(routeDateFilter.value, routeStatusFilter.value)
                selectedStopId.value = stops.value.firstOrNull()?.id
            }
        }) { Text("Cargar ruta del dia") }
        routeQuality.value.forEach { snapshot ->
            Text("KPI ruta ${snapshot.scopeLabel}: ${snapshot.serviceQualityScore}%")
            Text(
                "Periodo ${snapshot.periodStart} - ${snapshot.periodEnd} | completados ${snapshot.deliveredCompleted + snapshot.pickupsCompleted}/${snapshot.assignedWithAttempt}"
            )
            Button(onClick = { onOpenRouteQuality(snapshot.scopeId) }) {
                Text("Ver detalle KPI ruta")
            }
        }
        Button(onClick = {
            scope.launch {
                routeQuality.value = ApiProvider.client.qualityRouteSnapshots()
                message.value = "KPI de ruta actualizado"
            }
        }) { Text("Refrescar KPI ruta") }
        if (canAccessNetwork.value) {
            Button(onClick = onOpenNetworkNodes) { Text("Red operativa (Hubs/Depots/Puntos)") }
        }
        Text("Parada activa: ${selectedStop?.reference ?: "-"}")
        stops.value.forEach { stop ->
            Button(onClick = { selectedStopId.value = stop.id }) {
                val marker = if (selectedStop?.id == stop.id) "[*]" else "[ ]"
                Text("$marker #${stop.sequence} ${stop.stopType} ${stop.reference} (${stop.status})")
            }
        }

        OutlinedTextField(
            value = scanCode.value,
            onValueChange = { scanCode.value = it },
            label = { Text("Scan code") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(onClick = {
            val target = selectedStop ?: return@Button
            scope.launch {
                val ok = ApiProvider.client.registerScan(target.entityType, target.entityId, scanCode.value)
                if (ok) {
                    stops.value = stops.value.map { stop ->
                        if (stop.id == target.id) stop.copy(status = "in_progress") else stop
                    }
                }
                message.value = if (ok) "Scan registrado" else "Error scan"
            }
        }) { Text("Registrar Scan") }

        OutlinedTextField(
            value = podSignature.value,
            onValueChange = { podSignature.value = it },
            label = { Text("Firma POD") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(onClick = {
            val target = selectedStop ?: return@Button
            scope.launch {
                val ok = ApiProvider.client.registerPod(target.entityType, target.entityId, podSignature.value)
                if (ok) {
                    stops.value = stops.value.map { stop ->
                        if (stop.id == target.id) stop.copy(status = "completed") else stop
                    }
                }
                message.value = if (ok) "POD registrado" else "Error POD"
            }
        }) { Text("Registrar POD") }

        OutlinedTextField(
            value = pickupRef.value,
            onValueChange = { pickupRef.value = it },
            label = { Text("Referencia pickup") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(onClick = {
            scope.launch {
                val normalizedPickupRef = pickupRef.value.trim()
                if (normalizedPickupRef.isBlank() || normalizedPickupRef.length < 4) {
                    message.value = "Referencia pickup invalida."
                    return@launch
                }
                val ok = ApiProvider.client.createPickup(pickupRef.value, "NORMAL", "00000000-0000-0000-0000-000000000001")
                if (ok) {
                    prefs.edit().putString("pickup_ref", normalizedPickupRef).apply()
                }
                message.value = if (ok) "Pickup NORMAL creado" else "Error pickup"
            }
        }) { Text("Pickup NORMAL") }

        Button(onClick = {
            scope.launch {
                val normalizedPickupRef = pickupRef.value.trim()
                if (normalizedPickupRef.isBlank() || normalizedPickupRef.length < 4) {
                    message.value = "Referencia pickup invalida."
                    return@launch
                }
                val ok = ApiProvider.client.createPickup(pickupRef.value, "RETURN", "00000000-0000-0000-0000-000000000001")
                if (ok) {
                    prefs.edit().putString("pickup_ref", normalizedPickupRef).apply()
                }
                message.value = if (ok) "Pickup RETURN creado" else "Error pickup"
            }
        }) { Text("Pickup RETURN") }

        OutlinedTextField(
            value = incidentCode.value,
            onValueChange = { incidentCode.value = it },
            label = { Text("Codigo incidencia") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = incidentNotes.value,
            onValueChange = { incidentNotes.value = it },
            label = { Text("Notas incidencia") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(onClick = {
            val target = selectedStop ?: return@Button
            scope.launch {
                if (incidentCode.value.trim().isBlank()) {
                    message.value = "Codigo incidencia obligatorio."
                    return@launch
                }
                val ok = ApiProvider.client.registerIncident(
                    incidentableType = target.entityType,
                    incidentableId = target.entityId,
                    catalogCode = incidentCode.value,
                    category = incidentCategoryForCode(incidentCode.value),
                    notes = incidentNotes.value
                )
                if (ok) {
                    prefs.edit().putString("incident_code", incidentCode.value.trim()).apply()
                    stops.value = stops.value.map { stop ->
                        if (stop.id == target.id) stop.copy(status = "incident") else stop
                    }
                }
                message.value = if (ok) "Incidencia registrada" else "Error incidencia"
            }
        }) { Text("Registrar Incidencia") }

        Button(onClick = {
            scope.launch {
                ApiProvider.client.logout()
                SessionStore.updateToken(null)
                SessionStore.persist(context)
                onLogout()
            }
        }) { Text("Cerrar sesión") }

        if (message.value.isNotBlank()) Text(message.value)
    }
}

private fun incidentCategoryForCode(code: String): String {
    val normalized = code.trim().uppercase()
    return when {
        normalized.startsWith("ABSENT") -> "absent"
        normalized.startsWith("RETRY") -> "retry"
        normalized.startsWith("FAILED") -> "failed"
        else -> "general"
    }
}

private fun isValidRouteDate(value: String): Boolean {
    if (value.isBlank()) return true
    return try {
        LocalDate.parse(value)
        true
    } catch (_: DateTimeParseException) {
        false
    }
}
