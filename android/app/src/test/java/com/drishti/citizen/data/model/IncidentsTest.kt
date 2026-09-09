package com.drishti.citizen.data.model

import com.drishti.citizen.core.ui.component.BadgeTone
import org.junit.Assert.assertEquals
import org.junit.Test

class IncidentsTest {

    @Test
    fun `status labels collapse the review states`() {
        assertEquals("Under review", Incidents.statusLabel("ai_verified"))
        assertEquals("Under review", Incidents.statusLabel("human_review"))
        assertEquals("Verified by responder", Incidents.statusLabel("verified"))
        assertEquals("Not verified", Incidents.statusLabel("rejected"))
        assertEquals("Response in progress", Incidents.statusLabel("in_progress"))
        assertEquals("Something else", Incidents.statusLabel("something_else"))
    }

    @Test
    fun `status tones`() {
        assertEquals(BadgeTone.WARN, Incidents.statusTone("reported"))
        assertEquals(BadgeTone.SUCCESS, Incidents.statusTone("verified"))
        assertEquals(BadgeTone.SUCCESS, Incidents.statusTone("resolved"))
        assertEquals(BadgeTone.INFO, Incidents.statusTone("in_progress"))
        assertEquals(BadgeTone.NEUTRAL, Incidents.statusTone("rejected"))
    }

    @Test
    fun `severity tone and label`() {
        assertEquals(BadgeTone.SUCCESS, Incidents.severityTone("low"))
        assertEquals(BadgeTone.WARN, Incidents.severityTone("moderate"))
        assertEquals(BadgeTone.DANGER, Incidents.severityTone("very_high"))
        assertEquals("very high", Incidents.severityLabel("very_high"))
    }

    @Test
    fun `type label is capitalised`() {
        assertEquals("Flood", Incidents.typeLabel("flood"))
        assertEquals("Other", Incidents.typeLabel("other"))
    }
}
