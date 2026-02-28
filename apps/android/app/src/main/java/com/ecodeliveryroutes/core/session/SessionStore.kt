package com.ecodeliveryroutes.core.session

object SessionStore {
    var token: String? = null
        private set

    fun updateToken(value: String?) {
        token = value
    }

    fun isAuthenticated(): Boolean = !token.isNullOrBlank()
}
