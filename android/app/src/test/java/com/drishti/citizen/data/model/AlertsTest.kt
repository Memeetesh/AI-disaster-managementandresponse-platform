package com.drishti.citizen.data.model

import com.drishti.citizen.data.remote.dto.AlertDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AlertsTest {

    private fun alert(id: Int, severity: String, issuedAt: String) =
        AlertDto(id = id, source = "imd", type = "flood", severity = severity, message = "m", issuedAt = issuedAt)

    @Test
    fun `topAlert picks the most severe`() {
        val top = Alerts.topAlert(
            listOf(
                alert(1, "moderate", "2026-09-01T10:00:00Z"),
                alert(2, "critical", "2026-09-01T09:00:00Z"),
                alert(3, "high", "2026-09-01T11:00:00Z"),
            ),
        )
        assertEquals(2, top?.id)
    }

    @Test
    fun `ties are broken by most recent issued_at`() {
        val top = Alerts.topAlert(
            listOf(
                alert(1, "high", "2026-09-01T10:00:00Z"),
                alert(2, "high", "2026-09-01T12:00:00Z"),
                alert(3, "high", "2026-09-01T08:00:00Z"),
            ),
        )
        assertEquals(2, top?.id)
    }

    @Test
    fun `empty list yields null`() {
        assertNull(Alerts.topAlert(emptyList()))
    }

    @Test
    fun `relativeTime buckets`() {
        val now = java.time.Instant.parse("2026-09-01T12:00:00Z").toEpochMilli()
        assertEquals("just now", Alerts.relativeTime("2026-09-01T11:59:30Z", now))
        assertEquals("5m ago", Alerts.relativeTime("2026-09-01T11:55:00Z", now))
        assertEquals("3h ago", Alerts.relativeTime("2026-09-01T09:00:00Z", now))
        assertEquals("2d ago", Alerts.relativeTime("2026-08-30T12:00:00Z", now))
        assertEquals("—", Alerts.relativeTime("not-a-date", now))
    }

    @Test
    fun `source and severity labels`() {
        assertEquals("Command Center", Alerts.sourceLabel("admin"))
        assertEquals("Alert", Alerts.sourceLabel("weird"))
        assertEquals("very high", Alerts.severityLabel("very_high"))
    }
}
