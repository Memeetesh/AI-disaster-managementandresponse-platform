package com.drishti.citizen.core.realtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * The citizen-visible subset of `GET /stream` events, normalised to "what to
 * refetch". Mirrors the switch in `frontend/src/lib/realtime.tsx` — operator
 * events (`responder.*`, `simulator.*`, dashboard) are dropped.
 */
sealed interface RealtimeEvent {

    /** An incident/rescue the citizen owns changed. `incidentId` may be null. */
    data class IncidentChanged(val incidentId: Int?) : RealtimeEvent

    data object RiskUpdated : RealtimeEvent
    data object ShelterUpdated : RealtimeEvent
    data object AlertsChanged : RealtimeEvent
    data object FamilyUpdated : RealtimeEvent

    /** The stream (re)connected — refetch everything realtime-backed once. */
    data object Reconnected : RealtimeEvent

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun fromSse(type: String, data: String?): RealtimeEvent? = when (type) {
            "incident.created", "incident.updated", "rescue.updated" ->
                IncidentChanged(incidentIdOf(data))
            "risk.updated" -> RiskUpdated
            "shelter.updated" -> ShelterUpdated
            "alert.created", "alert.updated" -> AlertsChanged
            "family.updated" -> FamilyUpdated
            else -> null
        }

        private fun incidentIdOf(data: String?): Int? {
            if (data.isNullOrBlank()) return null
            return runCatching {
                json.parseToJsonElement(data).jsonObject["id"]?.jsonPrimitive?.intOrNull
            }.getOrNull()
        }
    }
}
