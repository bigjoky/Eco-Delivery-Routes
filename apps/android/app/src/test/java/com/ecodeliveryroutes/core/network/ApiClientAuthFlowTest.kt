package com.ecodeliveryroutes.core.network

import com.ecodeliveryroutes.core.session.SessionStore
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ApiClientAuthFlowTest {
    private var server: MockWebServer? = null

    @AfterTest
    fun teardown() {
        server?.shutdown()
        server = null
        SessionStore.updateToken(null)
    }

    @Test
    fun `client refreshes token on 401 and logout uses refreshed token`() = runBlocking {
        var logoutAuthorization = ""

        val localServer = MockWebServer().apply {
            dispatcher = object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    val auth = request.getHeader("Authorization").orEmpty()
                    return when (request.path) {
                        "/auth/login" -> MockResponse()
                            .setResponseCode(200)
                            .setBody("""{"token":"old-token","token_type":"Bearer"}""")
                        "/auth/refresh" -> {
                            if (auth == "Bearer old-token") {
                                MockResponse()
                                    .setResponseCode(200)
                                    .setBody("""{"token":"new-token","token_type":"Bearer"}""")
                            } else {
                                MockResponse()
                                    .setResponseCode(401)
                                    .setBody("""{"error":{"code":"AUTH_UNAUTHORIZED"}}""")
                            }
                        }
                        "/driver/me/route" -> when (auth) {
                            "Bearer old-token" -> MockResponse()
                                .setResponseCode(401)
                                .setBody("""{"error":{"code":"AUTH_UNAUTHORIZED"}}""")
                            "Bearer new-token" -> MockResponse()
                                .setResponseCode(200)
                                .setBody("""{"data":{"stops":[{"id":"st-auth-1","sequence":1,"stop_type":"DELIVERY","entity_type":"shipment","entity_id":"shipment-1","reference":"SHP-AUTH-1","status":"in_progress"}]}}""")
                            else -> MockResponse()
                                .setResponseCode(401)
                                .setBody("""{"error":{"code":"AUTH_UNAUTHORIZED"}}""")
                        }
                        "/auth/logout" -> {
                            logoutAuthorization = auth
                            MockResponse().setResponseCode(200).setBody("""{"message":"Logout successful."}""")
                        }
                        else -> MockResponse().setResponseCode(404)
                    }
                }
            }
            start()
        }
        server = localServer

        val client = ApiClient(localServer.url("/").toString().removeSuffix("/"))
        val token = client.login("admin@eco.local", "password123")
        SessionStore.updateToken(token)

        val stops = client.myRouteStops()
        assertTrue(stops.isNotEmpty())
        assertEquals("st-auth-1", stops.first().id)
        assertEquals("new-token", SessionStore.token)

        client.logout()
        assertEquals("Bearer new-token", logoutAuthorization)
    }
}
