package com.ecodeliveryroutes.core.model

data class AuthProfile(
    val id: String,
    val name: String,
    val email: String,
    val status: String,
    val roleCodes: List<String>
)
