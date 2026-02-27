package com.ecodeliveryroutes.core.network

import kotlin.test.Test
import kotlin.test.assertEquals
import org.json.JSONArray
import org.json.JSONObject

class ApiClientParsingTest {
    @Test
    fun `parseRouteStops normalizes entity contract for shipment and pickup`() {
        val stops = JSONArray()
            .put(
                JSONObject()
                    .put("id", "st-1")
                    .put("sequence", 1)
                    .put("stop_type", "DELIVERY")
                    .put("shipment_id", "00000000-0000-0000-0000-000000000101")
                    .put("status", "planned")
            )
            .put(
                JSONObject()
                    .put("id", "st-2")
                    .put("sequence", 2)
                    .put("stop_type", "PICKUP")
                    .put("pickup_id", "00000000-0000-0000-0000-000000000201")
                    .put("status", "planned")
            )

        val parsed = parseRouteStops(stops)

        assertEquals(2, parsed.size)
        assertEquals("shipment", parsed[0].entityType)
        assertEquals("00000000-0000-0000-0000-000000000101", parsed[0].entityId)
        assertEquals("pickup", parsed[1].entityType)
        assertEquals("00000000-0000-0000-0000-000000000201", parsed[1].entityId)
    }

    @Test
    fun `parseRouteStops prioritizes explicit entity values when present`() {
        val stops = JSONArray()
            .put(
                JSONObject()
                    .put("id", "st-10")
                    .put("sequence", 10)
                    .put("stop_type", "DELIVERY")
                    .put("entity_type", "shipment")
                    .put("entity_id", "custom-entity-id")
                    .put("reference", "SHP-REF-10")
                    .put("status", "in_progress")
            )

        val parsed = parseRouteStops(stops)

        assertEquals(1, parsed.size)
        assertEquals("shipment", parsed[0].entityType)
        assertEquals("custom-entity-id", parsed[0].entityId)
        assertEquals("SHP-REF-10", parsed[0].reference)
    }
}
