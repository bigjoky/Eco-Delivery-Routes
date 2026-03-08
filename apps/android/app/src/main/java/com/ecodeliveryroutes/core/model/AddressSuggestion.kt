package com.ecodeliveryroutes.core.model

data class AddressSuggestion(
    val source: String,
    val sourceId: String,
    val addressStreet: String?,
    val addressNumber: String?,
    val postalCode: String?,
    val city: String?,
    val province: String?,
    val country: String?,
    val addressNotes: String?
)
