package com.drishti.citizen.data.model

import com.drishti.citizen.core.ui.component.BadgeTone
import com.drishti.citizen.data.remote.dto.AlertDto
import java.time.Instant
import kotlin.math.roundToLong

/** Ports `frontend/src/lib/alerts.ts`. */
object Alerts {

    private val SEVERITY_RANK = mapOf(
        "low" to 0,
        "moderate" to 1,
        "high" to 2,
        "very_high" to 3,
        "critical" to 4,
    )

    /** Most-severe alert, ties broken by most recent `issued_at`. */
    fun topAlert(alerts: List<AlertDto>): AlertDto? =
        alerts.maxWithOrNull(
            compareBy({ SEVERITY_RANK[it.severity] ?: 0 }, { it.issuedAt }),
        )

    fun sourceLabel(source: String): String = when (source) {
        "imd" -> "IMD"
        "sachet" -> "SACHET"
        "simulator" -> "Disaster Simulator"
        "admin" -> "Command Center"
        else -> "Alert"
    }

    fun severityLabel(severity: String): String = severity.replace('_', ' ')

    /** Chip colour for the authority-messages timeline (web: navy / warn / danger). */
    fun severityTone(severity: String): BadgeTone = when (severity) {
        "low" -> BadgeTone.INFO
        "moderate" -> BadgeTone.WARN
        else -> BadgeTone.DANGER
    }

    fun relativeTime(iso: String, nowEpochMs: Long = System.currentTimeMillis()): String {
        val issuedAt = runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull() ?: return "—"
        val secs = (nowEpochMs - issuedAt) / 1000.0
        if (secs < 60) return "just now"
        val mins = (secs / 60).roundToLong()
        if (mins < 60) return "${mins}m ago"
        val hrs = (mins / 60.0).roundToLong()
        if (hrs < 24) return "${hrs}h ago"
        return "${(hrs / 24.0).roundToLong()}d ago"
    }
}
