package com.drishti.citizen.core.realtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RealtimeEventTest {

    @Test
    fun `incident events carry the id when present`() {
        val event = RealtimeEvent.fromSse("incident.updated", """{"id":42,"status":"verified"}""")
        assertEquals(RealtimeEvent.IncidentChanged(42), event)
    }

    @Test
    fun `incident events tolerate missing or unparseable data`() {
        assertEquals(RealtimeEvent.IncidentChanged(null), RealtimeEvent.fromSse("incident.created", null))
        assertEquals(RealtimeEvent.IncidentChanged(null), RealtimeEvent.fromSse("incident.created", "not-json"))
        assertEquals(RealtimeEvent.IncidentChanged(null), RealtimeEvent.fromSse("rescue.updated", "{}"))
    }

    @Test
    fun `area-wide events map to their refetch targets`() {
        assertEquals(RealtimeEvent.RiskUpdated, RealtimeEvent.fromSse("risk.updated", "{}"))
        assertEquals(RealtimeEvent.ShelterUpdated, RealtimeEvent.fromSse("shelter.updated", "{}"))
        assertEquals(RealtimeEvent.AlertsChanged, RealtimeEvent.fromSse("alert.created", "{}"))
        assertEquals(RealtimeEvent.AlertsChanged, RealtimeEvent.fromSse("alert.updated", "{}"))
        assertEquals(RealtimeEvent.FamilyUpdated, RealtimeEvent.fromSse("family.updated", "{}"))
    }

    @Test
    fun `operator-only and unknown events are dropped`() {
        assertNull(RealtimeEvent.fromSse("responder.updated", "{}"))
        assertNull(RealtimeEvent.fromSse("simulator.updated", "{}"))
        assertNull(RealtimeEvent.fromSse("", "{}"))
        assertNull(RealtimeEvent.fromSse("something.else", "{}"))
    }
}
