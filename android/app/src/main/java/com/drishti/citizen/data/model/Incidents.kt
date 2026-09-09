package com.drishti.citizen.data.model

import com.drishti.citizen.core.ui.component.BadgeTone
import java.util.Locale

/** Ports the badge/label maps in the web `(citizen)/reports` page. */
object Incidents {

    fun typeLabel(type: String): String =
        type.replaceFirstChar { it.titlecase(Locale.US) }

    fun statusLabel(status: String): String = when (status) {
        "reported" -> "Reported"
        "ai_verified", "human_review" -> "Under review"
        "verified" -> "Verified by responder"
        "rejected" -> "Not verified"
        "in_progress" -> "Response in progress"
        "resolved" -> "Resolved"
        else -> status.replace('_', ' ').replaceFirstChar { it.titlecase(Locale.US) }
    }

    fun statusTone(status: String): BadgeTone = when (status) {
        "reported", "ai_verified", "human_review" -> BadgeTone.WARN
        "verified", "resolved" -> BadgeTone.SUCCESS
        "in_progress" -> BadgeTone.INFO
        "rejected" -> BadgeTone.NEUTRAL
        else -> BadgeTone.NEUTRAL
    }

    fun severityLabel(severity: String): String = severity.replace('_', ' ')

    fun severityTone(severity: String): BadgeTone = when (severity) {
        "low" -> BadgeTone.SUCCESS
        "moderate" -> BadgeTone.WARN
        "high", "very_high", "critical" -> BadgeTone.DANGER
        else -> BadgeTone.NEUTRAL
    }
}
