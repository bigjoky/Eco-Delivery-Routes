package com.ecodeliveryroutes.features.quality

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ecodeliveryroutes.core.model.QualityBreakdown
import com.ecodeliveryroutes.core.network.ApiProvider
import kotlinx.coroutines.launch

@Composable
fun RouteQualityScreen(routeId: String) {
    val scope = rememberCoroutineScope()
    val breakdown = remember { mutableStateOf<QualityBreakdown?>(null) }
    val granularity = remember { mutableStateOf("month") }
    val message = remember { mutableStateOf("") }

    suspend fun load() {
        breakdown.value = ApiProvider.client.qualityRouteBreakdown(routeId, granularity.value)
    }

    LaunchedEffect(routeId) {
        load()
    }

    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("KPI por Ruta")
        Text("Route ID: $routeId")
        Button(onClick = {
            granularity.value = if (granularity.value == "month") "week" else "month"
            scope.launch {
                load()
                message.value = "Granularidad: ${granularity.value}"
            }
        }) {
            Text("Cambiar granularidad (${granularity.value})")
        }

        Button(onClick = {
            scope.launch {
                load()
                message.value = "KPI actualizado"
            }
        }) {
            Text("Refrescar KPI ruta")
        }

        if (message.value.isNotBlank()) {
            Text(message.value)
        }

        val data = breakdown.value
        if (data == null) {
            Text("Cargando desglose...")
            return@Column
        }

        Text("Ruta: ${data.scopeLabel}")
        Text("Score: ${data.serviceQualityScore}%")
        Text("Completados: ${data.components.completedTotal}/${data.components.assignedWithAttempt}")
        Text("Fallidas: ${data.components.failedCount} | Ausencias: ${data.components.absentCount} | Reintentos: ${data.components.retryCount}")

        data.periods.forEach { period ->
            val progress = (period.completionRatio / 100.0).coerceIn(0.0, 1.0).toFloat()
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${period.periodKey} (${period.periodStart} - ${period.periodEnd})")
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Completados ${period.completedTotal}/${period.assignedWithAttempt} - ${period.completionRatio}%")
            }
        }
    }
}
