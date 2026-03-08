package com.ecodeliveryroutes.features.shipments

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ecodeliveryroutes.core.network.ApiProvider
import kotlinx.coroutines.launch

@Composable
fun ShipmentDraftScreen() {
    val scope = rememberCoroutineScope()
    val hubId = remember { mutableStateOf("00000000-0000-0000-0000-000000000001") }
    val serviceType = remember { mutableStateOf("express_1030") }
    val recipientDocType = remember { mutableStateOf("DNI") }
    val recipientDocument = remember { mutableStateOf("") }
    val recipientLegalName = remember { mutableStateOf("") }
    val recipientFirstName = remember { mutableStateOf("") }
    val recipientLastName = remember { mutableStateOf("") }
    val recipientPhone = remember { mutableStateOf("") }
    val recipientStreet = remember { mutableStateOf("") }
    val recipientNumber = remember { mutableStateOf("") }
    val recipientPostalCode = remember { mutableStateOf("") }
    val recipientCity = remember { mutableStateOf("") }
    val recipientCountry = remember { mutableStateOf("ES") }
    val recipientSuggestions = remember { mutableStateOf<List<String>>(emptyList()) }

    val senderDocType = remember { mutableStateOf("DNI") }
    val senderDocument = remember { mutableStateOf("") }
    val senderLegalName = remember { mutableStateOf("") }
    val senderFirstName = remember { mutableStateOf("") }
    val senderLastName = remember { mutableStateOf("") }
    val senderPhone = remember { mutableStateOf("") }
    val senderAddressLine = remember { mutableStateOf("") }

    val message = remember { mutableStateOf("Completa los campos obligatorios.") }

    Column(modifier = Modifier.padding(16.dp)) {
        Text("Nuevo envio (beta)")
        OutlinedTextField(
            value = hubId.value,
            onValueChange = { hubId.value = it },
            label = { Text("Hub ID") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = serviceType.value,
            onValueChange = { serviceType.value = it },
            label = { Text("Service type") },
            modifier = Modifier.fillMaxWidth()
        )

        Text("Destinatario")
        OutlinedTextField(
            value = recipientDocType.value,
            onValueChange = { recipientDocType.value = it.uppercase() },
            label = { Text("Tipo doc (DNI/NIE/PASSPORT/CIF)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recipientDocument.value,
            onValueChange = {
                recipientDocument.value = it
                recipientDocType.value = inferDocumentType(it, recipientDocType.value)
            },
            label = { Text("Documento") },
            modifier = Modifier.fillMaxWidth()
        )
        if (recipientDocType.value == "CIF") {
            OutlinedTextField(
                value = recipientLegalName.value,
                onValueChange = { recipientLegalName.value = it },
                label = { Text("Razon social") },
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            OutlinedTextField(
                value = recipientFirstName.value,
                onValueChange = { recipientFirstName.value = it },
                label = { Text("Nombre") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = recipientLastName.value,
                onValueChange = { recipientLastName.value = it },
                label = { Text("Apellidos") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        OutlinedTextField(
            value = recipientPhone.value,
            onValueChange = { recipientPhone.value = it },
            label = { Text("Telefono destinatario") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recipientStreet.value,
            onValueChange = { recipientStreet.value = it },
            label = { Text("Calle destinatario") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recipientNumber.value,
            onValueChange = { recipientNumber.value = it },
            label = { Text("Numero destinatario") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recipientPostalCode.value,
            onValueChange = { recipientPostalCode.value = it },
            label = { Text("Codigo postal destinatario") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recipientCity.value,
            onValueChange = { recipientCity.value = it },
            label = { Text("Ciudad destinatario") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recipientCountry.value,
            onValueChange = { recipientCountry.value = it.uppercase() },
            label = { Text("Pais destinatario (ISO2)") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = {
            val q = listOf(recipientStreet.value, recipientCity.value, recipientPostalCode.value).joinToString(" ").trim()
            if (q.isBlank()) {
                recipientSuggestions.value = emptyList()
                return@Button
            }
            scope.launch {
                val suggestions = ApiProvider.client.addressSuggestions(
                    q = q,
                    kind = "recipient",
                    city = recipientCity.value.ifBlank { null },
                    postalCode = recipientPostalCode.value.ifBlank { null },
                    limit = 5
                )
                recipientSuggestions.value = suggestions.map { item ->
                    listOf(
                        item.addressStreet ?: "",
                        item.addressNumber ?: "",
                        item.postalCode ?: "",
                        item.city ?: ""
                    ).joinToString(" ").trim()
                }
                val first = suggestions.firstOrNull()
                if (first != null) {
                    recipientStreet.value = first.addressStreet ?: recipientStreet.value
                    recipientNumber.value = first.addressNumber ?: recipientNumber.value
                    recipientPostalCode.value = first.postalCode ?: recipientPostalCode.value
                    recipientCity.value = first.city ?: recipientCity.value
                    recipientCountry.value = first.country ?: recipientCountry.value
                }
            }
        }) { Text("Sugerir direccion destinatario") }
        recipientSuggestions.value.forEach { suggestion ->
            Text("• $suggestion")
        }

        Text("Remitente")
        OutlinedTextField(
            value = senderDocType.value,
            onValueChange = { senderDocType.value = it.uppercase() },
            label = { Text("Tipo doc (DNI/NIE/PASSPORT/CIF)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = senderDocument.value,
            onValueChange = {
                senderDocument.value = it
                senderDocType.value = inferDocumentType(it, senderDocType.value)
            },
            label = { Text("Documento") },
            modifier = Modifier.fillMaxWidth()
        )
        if (senderDocType.value == "CIF") {
            OutlinedTextField(
                value = senderLegalName.value,
                onValueChange = { senderLegalName.value = it },
                label = { Text("Razon social") },
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            OutlinedTextField(
                value = senderFirstName.value,
                onValueChange = { senderFirstName.value = it },
                label = { Text("Nombre") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = senderLastName.value,
                onValueChange = { senderLastName.value = it },
                label = { Text("Apellidos") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        OutlinedTextField(
            value = senderPhone.value,
            onValueChange = { senderPhone.value = it },
            label = { Text("Telefono remitente") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = senderAddressLine.value,
            onValueChange = { senderAddressLine.value = it },
            label = { Text("Direccion remitente") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(onClick = {
            val validation = validateDraft(
                recipientDocType = recipientDocType.value,
                recipientDocument = recipientDocument.value,
                recipientLegalName = recipientLegalName.value,
                recipientFirstName = recipientFirstName.value,
                recipientLastName = recipientLastName.value,
                recipientPhone = recipientPhone.value,
                senderDocType = senderDocType.value,
                senderDocument = senderDocument.value,
                senderLegalName = senderLegalName.value,
                senderFirstName = senderFirstName.value,
                senderLastName = senderLastName.value,
                senderPhone = senderPhone.value,
                recipientCountry = recipientCountry.value,
                recipientPostalCode = recipientPostalCode.value
            )
            if (validation != "Borrador valido.") {
                message.value = validation
                return@Button
            }
            val recipientName = if (recipientDocType.value == "CIF") recipientLegalName.value else "${recipientFirstName.value} ${recipientLastName.value}".trim()
            val senderName = if (senderDocType.value == "CIF") senderLegalName.value else "${senderFirstName.value} ${senderLastName.value}".trim()
            scope.launch {
                val created = ApiProvider.client.createShipment(
                    hubId = hubId.value.trim(),
                    consigneeName = recipientName,
                    consigneeDocumentId = recipientDocument.value.trim(),
                    consigneePhone = recipientPhone.value.trim(),
                    senderName = senderName,
                    senderDocumentId = senderDocument.value.trim(),
                    senderPhone = senderPhone.value.trim(),
                    serviceType = serviceType.value.trim().ifEmpty { "express_1030" },
                    addressStreet = recipientStreet.value.trim().ifEmpty { null },
                    addressNumber = recipientNumber.value.trim().ifEmpty { null },
                    postalCode = normalizePostalCode(recipientCountry.value, recipientPostalCode.value),
                    city = recipientCity.value.trim().ifEmpty { null },
                    country = recipientCountry.value.trim().uppercase().ifEmpty { "ES" },
                    senderAddressLine = senderAddressLine.value.trim().ifEmpty { null }
                )
                message.value = if (created) "Envio creado." else "No se pudo crear el envio."
            }
        }) {
            Text("Crear envio")
        }
        Text(message.value)
    }
}

private fun inferDocumentType(documentId: String, fallback: String): String {
    val normalized = documentId.trim().uppercase()
    return when {
        Regex("^[XYZ][0-9]{7}[A-Z]$").matches(normalized) -> "NIE"
        Regex("^[0-9]{8}[A-Z]$").matches(normalized) -> "DNI"
        Regex("^[A-HJNPQRSUVW][0-9]{7}[0-9A-J]$").matches(normalized) -> "CIF"
        else -> fallback
    }
}

private fun validateDraft(
    recipientDocType: String,
    recipientDocument: String,
    recipientLegalName: String,
    recipientFirstName: String,
    recipientLastName: String,
    recipientPhone: String,
    senderDocType: String,
    senderDocument: String,
    senderLegalName: String,
    senderFirstName: String,
    senderLastName: String,
    senderPhone: String,
    recipientCountry: String,
    recipientPostalCode: String
): String {
    if (recipientDocument.trim().isEmpty()) return "Documento de destinatario obligatorio."
    if (senderDocument.trim().isEmpty()) return "Documento de remitente obligatorio."
    if (recipientDocType == "CIF") {
        if (recipientLegalName.trim().isEmpty()) return "Razon social destinatario obligatoria."
    } else if (recipientFirstName.trim().isEmpty() || recipientLastName.trim().isEmpty()) {
        return "Nombre y apellidos destinatario obligatorios."
    }
    if (senderDocType == "CIF") {
        if (senderLegalName.trim().isEmpty()) return "Razon social remitente obligatoria."
    } else if (senderFirstName.trim().isEmpty() || senderLastName.trim().isEmpty()) {
        return "Nombre y apellidos remitente obligatorios."
    }
    if (recipientPhone.trim().isEmpty()) return "Telefono destinatario obligatorio."
    if (senderPhone.trim().isEmpty()) return "Telefono remitente obligatorio."
    if (!isValidPostalCode(recipientCountry, recipientPostalCode)) return "Codigo postal destinatario invalido."
    return "Borrador valido."
}

private fun normalizePostalCode(country: String, postalCode: String): String {
    val normalizedCountry = country.trim().uppercase()
    val cleaned = postalCode.trim().uppercase().replace("\\s+".toRegex(), "")
    if (cleaned.isEmpty()) return ""
    if (normalizedCountry == "PT") {
        val digits = cleaned.replace("[^0-9]".toRegex(), "")
        if (digits.length == 7) return "${digits.substring(0, 4)}-${digits.substring(4)}"
    }
    return cleaned
}

private fun isValidPostalCode(country: String, postalCode: String): Boolean {
    val normalizedCountry = country.trim().uppercase()
    val normalizedPostal = normalizePostalCode(normalizedCountry, postalCode)
    if (normalizedPostal.isEmpty()) return true
    return when (normalizedCountry) {
        "ES", "FR", "DE", "IT" -> Regex("^[0-9]{5}$").matches(normalizedPostal)
        "PT" -> Regex("^[0-9]{4}-?[0-9]{3}$").matches(normalizedPostal)
        else -> Regex("^[0-9A-Z-]{4,10}$").matches(normalizedPostal)
    }
}
