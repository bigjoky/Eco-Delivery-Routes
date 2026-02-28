package com.ecodeliveryroutes.core.session

import android.content.Context

object SessionStore {
    private const val PREFS = "eco_delivery_routes_session"
    private const val KEY_TOKEN = "auth_token"

    private var initialized = false
    var token: String? = null
        private set

    fun init(context: Context) {
        if (initialized) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        token = prefs.getString(KEY_TOKEN, null)
        initialized = true
    }

    fun updateToken(value: String?) {
        token = value
    }

    fun persist(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .apply()
    }

    fun isAuthenticated(): Boolean = !token.isNullOrBlank()
}
