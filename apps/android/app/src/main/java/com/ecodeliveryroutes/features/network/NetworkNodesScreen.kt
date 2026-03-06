package com.ecodeliveryroutes.features.network

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ecodeliveryroutes.core.model.DepotSummary
import com.ecodeliveryroutes.core.model.HubSummary
import com.ecodeliveryroutes.core.model.PointSummary
import com.ecodeliveryroutes.core.network.ApiProvider
import kotlinx.coroutines.launch

@Composable
fun NetworkNodesScreen() {
    val hubs = remember { mutableStateOf<List<HubSummary>>(emptyList()) }
    val depots = remember { mutableStateOf<List<DepotSummary>>(emptyList()) }
    val points = remember { mutableStateOf<List<PointSummary>>(emptyList()) }
    val includeArchived = remember { mutableStateOf(false) }
    val message = remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        hubs.value = ApiProvider.client.hubs(onlyActive = false, includeDeleted = includeArchived.value)
        depots.value = ApiProvider.client.depots(includeDeleted = includeArchived.value)
        points.value = ApiProvider.client.points(includeDeleted = includeArchived.value)
    }

    LaunchedEffect(includeArchived.value) {
        load()
    }

    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Red Operativa")
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Checkbox(
                checked = includeArchived.value,
                onCheckedChange = { includeArchived.value = it }
            )
            Text("Mostrar archivados")
            Button(onClick = { scope.launch { load() } }) {
                Text("Refrescar")
            }
        }

        if (message.value.isNotBlank()) Text(message.value)

        Text("Hubs")
        hubs.value.forEach { item ->
            NodeCard(
                title = "${item.code} · ${item.name}",
                subtitle = listOfNotNull(item.city, if (item.deletedAt != null) "Archivado" else "Activo").joinToString(" · "),
                archived = item.deletedAt != null,
                onArchive = {
                    scope.launch {
                        val ok = ApiProvider.client.archiveHub(item.id)
                        message.value = if (ok) "Hub archivado" else "Error archivando hub"
                        load()
                    }
                },
                onRestore = {
                    scope.launch {
                        val ok = ApiProvider.client.restoreHub(item.id)
                        message.value = if (ok) "Hub restaurado" else "Error restaurando hub"
                        load()
                    }
                }
            )
        }

        Text("Depots")
        depots.value.forEach { item ->
            NodeCard(
                title = "${item.code} · ${item.name}",
                subtitle = "Hub ${item.hubId}${item.city?.let { " · $it" } ?: ""}${if (item.deletedAt != null) " · Archivado" else ""}",
                archived = item.deletedAt != null,
                onArchive = {
                    scope.launch {
                        val ok = ApiProvider.client.archiveDepot(item.id)
                        message.value = if (ok) "Depot archivado" else "Error archivando depot"
                        load()
                    }
                },
                onRestore = {
                    scope.launch {
                        val ok = ApiProvider.client.restoreDepot(item.id)
                        message.value = if (ok) "Depot restaurado" else "Error restaurando depot"
                        load()
                    }
                }
            )
        }

        Text("Puntos")
        points.value.forEach { item ->
            NodeCard(
                title = "${item.code} · ${item.name}",
                subtitle = "Hub ${item.hubId}${item.depotId?.let { " · Depot $it" } ?: ""}${item.city?.let { " · $it" } ?: ""}${if (item.deletedAt != null) " · Archivado" else ""}",
                archived = item.deletedAt != null,
                onArchive = {
                    scope.launch {
                        val ok = ApiProvider.client.archivePoint(item.id)
                        message.value = if (ok) "Punto archivado" else "Error archivando punto"
                        load()
                    }
                },
                onRestore = {
                    scope.launch {
                        val ok = ApiProvider.client.restorePoint(item.id)
                        message.value = if (ok) "Punto restaurado" else "Error restaurando punto"
                        load()
                    }
                }
            )
        }
    }
}

@Composable
private fun NodeCard(
    title: String,
    subtitle: String,
    archived: Boolean,
    onArchive: () -> Unit,
    onRestore: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors()
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(title)
            Text(subtitle)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (archived) {
                    Button(onClick = onRestore) { Text("Restaurar") }
                } else {
                    Button(onClick = onArchive) { Text("Archivar") }
                }
            }
        }
    }
}
