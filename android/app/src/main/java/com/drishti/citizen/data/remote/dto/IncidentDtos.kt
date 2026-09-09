package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `IncidentOut` / `EvidenceOut` from `backend/app/schemas/incident.py`. The
 * AI fields on evidence (`extracted_text`, `ai_detection`, `ai_confidence`)
 * are ignored here — the citizen app only shows image thumbnails.
 */
@Serializable
data class EvidenceDto(
    val id: Int,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("audio_url") val audioUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class IncidentDto(
    val id: Int,
    val type: String,
    val latitude: Double,
    val longitude: Double,
    val severity: String,
    val confidence: Double = 0.0,
    val status: String,
    val description: String? = null,
    @SerialName("reported_by") val reportedBy: Int? = null,
    @SerialName("people_affected") val peopleAffected: Int = 0,
    @SerialName("created_at") val createdAt: String,
    @SerialName("verified_at") val verifiedAt: String? = null,
    val priority: String? = null,
    val evidence: List<EvidenceDto> = emptyList(),
) {
    val imageEvidenceUrls: List<String> get() = evidence.mapNotNull { it.imageUrl }
}
