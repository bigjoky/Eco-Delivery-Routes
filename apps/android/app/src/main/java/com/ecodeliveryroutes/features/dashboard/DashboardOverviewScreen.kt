package com.ecodeliveryroutes.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ecodeliveryroutes.core.model.DashboardOverview
import com.ecodeliveryroutes.core.network.ApiProvider
import kotlinx.coroutines.launch

@Composable
fun DashboardOverviewScreen(
    onOpenDriverRoute: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    val period = remember { mutableStateOf("7d") }
    val hubId = remember { mutableStateOf("") }
    val subcontractorId = remember { mutableStateOf("") }
    val message = remember { mutableStateOf("") }
    val overview = remember { mutableStateOf<DashboardOverview?>(null) }

    suspend fun load() {
        overview.value = ApiProvider.client.dashboardOverview(
            period = period.value,
            hubId = hubId.value.ifBlank { null },
            subcontractorId = subcontractorId.value.ifBlank { null }
        )
    }

    LaunchedEffect(Unit) {
        load()
    }

    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Everything at a glance", style = MaterialTheme.typography.headlineSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { period.value = "today" }) { Text("Hoy") }
            Button(onClick = { period.value = "7d" }) { Text("7d") }
            Button(onClick = { period.value = "30d" }) { Text("30d") }
            Button(onClick = { onOpenDriverRoute() }) { Text("Mi ruta") }
        }
        OutlinedTextField(
            value = hubId.value,
            onValueChange = { hubId.value = it },
            label = { Text("Hub ID (opcional)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = subcontractorId.value,
            onValueChange = { subcontractorId.value = it },
            label = { Text("Subcontrata ID (opcional)") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = {
            scope.launch {
                load()
                message.value = "Overview actualizado"
            }
        }) { Text("Actualizar overview") }

        if (message.value.isNotBlank()) Text(message.value)

        val data = overview.value
        if (data == null) {
            Text("Cargando overview...")
            return@Column
        }

        Text("Periodo: ${data.periodFrom} · ${data.periodTo}")
        Text("Envíos ${data.shipments} | Rutas ${data.routes} | Incidencias abiertas ${data.incidentsOpen}")
        Text("Calidad rutas ${data.routeQualityAvg}% (umbral ${data.qualityThreshold}%)")
        Text("Alertas: ${data.alerts.size}")
        data.alerts.forEach { alert ->
            Text("• ${alert.title} (${alert.count})")
        }

        TrendRow("Tendencia envíos", data.shipmentTrend)
        TrendRow("Tendencia rutas", data.routeTrend)
        TrendRow("Tendencia incidencias", data.incidentTrend)
    }
}

@Composable
private fun TrendRow(title: String, values: List<Int>) {
    val max = (values.maxOrNull() ?: 1).coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.labelMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            values.forEach { value ->
                val ratio = value.toFloat() / max.toFloat()
                val barHeight = (8 + (ratio * 44)).dp
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .width(10.dp)
                        .height(barHeight)
                        .background(MaterialTheme.colorScheme.primary)
                )
            }
        }
    }
}
