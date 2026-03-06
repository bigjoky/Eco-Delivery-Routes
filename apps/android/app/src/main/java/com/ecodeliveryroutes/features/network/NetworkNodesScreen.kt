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
import androidx.compose.material3.OutlinedTextField
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

    val newHubName = remember { mutableStateOf("") }
    val newHubCity = remember { mutableStateOf("") }
    val editHubId = remember { mutableStateOf("") }
    val editHubName = remember { mutableStateOf("") }
    val editHubCity = remember { mutableStateOf("") }

    val newDepotHubId = remember { mutableStateOf("") }
    val newDepotName = remember { mutableStateOf("") }
    val newDepotCity = remember { mutableStateOf("") }
    val editDepotId = remember { mutableStateOf("") }
    val editDepotName = remember { mutableStateOf("") }
    val editDepotCity = remember { mutableStateOf("") }

    val newPointHubId = remember { mutableStateOf("") }
    val newPointDepotId = remember { mutableStateOf("") }
    val newPointName = remember { mutableStateOf("") }
    val newPointCity = remember { mutableStateOf("") }
    val editPointId = remember { mutableStateOf("") }
    val editPointName = remember { mutableStateOf("") }
    val editPointCity = remember { mutableStateOf("") }

    val scope = rememberCoroutineScope()

    suspend fun load() {
        hubs.value = ApiProvider.client.hubs(onlyActive = false, includeDeleted = includeArchived.value)
        depots.value = ApiProvider.client.depots(includeDeleted = includeArchived.value)
        points.value = ApiProvider.client.points(includeDeleted = includeArchived.value)
        if (newDepotHubId.value.isBlank()) newDepotHubId.value = hubs.value.firstOrNull()?.id.orEmpty()
        if (newPointHubId.value.isBlank()) newPointHubId.value = hubs.value.firstOrNull()?.id.orEmpty()
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

        SectionCard(title = "Crear Hub") {
            OutlinedTextField(
                value = newHubName.value,
                onValueChange = { newHubName.value = it },
                label = { Text("Nombre hub") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newHubCity.value,
                onValueChange = { newHubCity.value = it },
                label = { Text("Ciudad") },
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    scope.launch {
                        val created = ApiProvider.client.createHub(newHubName.value.trim(), newHubCity.value.trim())
                        if (created != null) {
                            message.value = "Hub creado"
                            newHubName.value = ""
                            newHubCity.value = ""
                            load()
                        } else {
                            message.value = "Error creando hub"
                        }
                    }
                },
                enabled = newHubName.value.isNotBlank() && newHubCity.value.isNotBlank()
            ) {
                Text("Crear hub")
            }
        }

        Text("Hubs")
        hubs.value.forEach { item ->
            NodeCard(
                title = "${item.code} · ${item.name}",
                subtitle = listOfNotNull(item.city, if (item.deletedAt != null) "Archivado" else "Activo").joinToString(" · "),
                archived = item.deletedAt != null,
                onEdit = {
                    editHubId.value = item.id
                    editHubName.value = item.name
                    editHubCity.value = item.city ?: ""
                },
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

        if (editHubId.value.isNotBlank()) {
            SectionCard(title = "Editar Hub") {
                OutlinedTextField(
                    value = editHubName.value,
                    onValueChange = { editHubName.value = it },
                    label = { Text("Nombre hub") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = editHubCity.value,
                    onValueChange = { editHubCity.value = it },
                    label = { Text("Ciudad") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
                        scope.launch {
                            val updated = ApiProvider.client.updateHub(
                                id = editHubId.value,
                                name = editHubName.value.trim(),
                                city = editHubCity.value.trim().ifBlank { null }
                            )
                            message.value = if (updated != null) "Hub actualizado" else "Error actualizando hub"
                            if (updated != null) {
                                editHubId.value = ""
                                load()
                            }
                        }
                    }) {
                        Text("Guardar")
                    }
                    Button(onClick = { editHubId.value = "" }) {
                        Text("Cancelar")
                    }
                }
            }
        }

        SectionCard(title = "Crear Depot") {
            OutlinedTextField(
                value = newDepotHubId.value,
                onValueChange = { newDepotHubId.value = it },
                label = { Text("Hub ID") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newDepotName.value,
                onValueChange = { newDepotName.value = it },
                label = { Text("Nombre depot") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newDepotCity.value,
                onValueChange = { newDepotCity.value = it },
                label = { Text("Ciudad (opcional)") },
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    scope.launch {
                        val created = ApiProvider.client.createDepot(
                            hubId = newDepotHubId.value.trim(),
                            name = newDepotName.value.trim(),
                            city = newDepotCity.value.trim().ifBlank { null }
                        )
                        if (created != null) {
                            message.value = "Depot creado"
                            newDepotName.value = ""
                            newDepotCity.value = ""
                            load()
                        } else {
                            message.value = "Error creando depot"
                        }
                    }
                },
                enabled = newDepotHubId.value.isNotBlank() && newDepotName.value.isNotBlank()
            ) {
                Text("Crear depot")
            }
        }

        Text("Depots")
        depots.value.forEach { item ->
            NodeCard(
                title = "${item.code} · ${item.name}",
                subtitle = "Hub ${item.hubId}${item.city?.let { " · $it" } ?: ""}${if (item.deletedAt != null) " · Archivado" else ""}",
                archived = item.deletedAt != null,
                onEdit = {
                    editDepotId.value = item.id
                    editDepotName.value = item.name
                    editDepotCity.value = item.city ?: ""
                },
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

        if (editDepotId.value.isNotBlank()) {
            SectionCard(title = "Editar Depot") {
                OutlinedTextField(
                    value = editDepotName.value,
                    onValueChange = { editDepotName.value = it },
                    label = { Text("Nombre depot") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = editDepotCity.value,
                    onValueChange = { editDepotCity.value = it },
                    label = { Text("Ciudad") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
                        scope.launch {
                            val updated = ApiProvider.client.updateDepot(
                                id = editDepotId.value,
                                name = editDepotName.value.trim(),
                                city = editDepotCity.value.trim().ifBlank { null }
                            )
                            message.value = if (updated != null) "Depot actualizado" else "Error actualizando depot"
                            if (updated != null) {
                                editDepotId.value = ""
                                load()
                            }
                        }
                    }) {
                        Text("Guardar")
                    }
                    Button(onClick = { editDepotId.value = "" }) {
                        Text("Cancelar")
                    }
                }
            }
        }

        SectionCard(title = "Crear Punto") {
            OutlinedTextField(
                value = newPointHubId.value,
                onValueChange = { newPointHubId.value = it },
                label = { Text("Hub ID") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newPointDepotId.value,
                onValueChange = { newPointDepotId.value = it },
                label = { Text("Depot ID (opcional)") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newPointName.value,
                onValueChange = { newPointName.value = it },
                label = { Text("Nombre punto") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newPointCity.value,
                onValueChange = { newPointCity.value = it },
                label = { Text("Ciudad (opcional)") },
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    scope.launch {
                        val created = ApiProvider.client.createPoint(
                            hubId = newPointHubId.value.trim(),
                            depotId = newPointDepotId.value.trim().ifBlank { null },
                            name = newPointName.value.trim(),
                            city = newPointCity.value.trim().ifBlank { null }
                        )
                        if (created != null) {
                            message.value = "Punto creado"
                            newPointName.value = ""
                            newPointCity.value = ""
                            newPointDepotId.value = ""
                            load()
                        } else {
                            message.value = "Error creando punto"
                        }
                    }
                },
                enabled = newPointHubId.value.isNotBlank() && newPointName.value.isNotBlank()
            ) {
                Text("Crear punto")
            }
        }

        Text("Puntos")
        points.value.forEach { item ->
            NodeCard(
                title = "${item.code} · ${item.name}",
                subtitle = "Hub ${item.hubId}${item.depotId?.let { " · Depot $it" } ?: ""}${item.city?.let { " · $it" } ?: ""}${if (item.deletedAt != null) " · Archivado" else ""}",
                archived = item.deletedAt != null,
                onEdit = {
                    editPointId.value = item.id
                    editPointName.value = item.name
                    editPointCity.value = item.city ?: ""
                },
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

        if (editPointId.value.isNotBlank()) {
            SectionCard(title = "Editar Punto") {
                OutlinedTextField(
                    value = editPointName.value,
                    onValueChange = { editPointName.value = it },
                    label = { Text("Nombre punto") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = editPointCity.value,
                    onValueChange = { editPointCity.value = it },
                    label = { Text("Ciudad") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
                        scope.launch {
                            val updated = ApiProvider.client.updatePoint(
                                id = editPointId.value,
                                name = editPointName.value.trim(),
                                city = editPointCity.value.trim().ifBlank { null }
                            )
                            message.value = if (updated != null) "Punto actualizado" else "Error actualizando punto"
                            if (updated != null) {
                                editPointId.value = ""
                                load()
                            }
                        }
                    }) {
                        Text("Guardar")
                    }
                    Button(onClick = { editPointId.value = "" }) {
                        Text("Cancelar")
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors()
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(title)
            content()
        }
    }
}

@Composable
private fun NodeCard(
    title: String,
    subtitle: String,
    archived: Boolean,
    onEdit: () -> Unit,
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
                    Button(onClick = onEdit) { Text("Editar") }
                    Button(onClick = onArchive) { Text("Archivar") }
                }
            }
        }
    }
}
