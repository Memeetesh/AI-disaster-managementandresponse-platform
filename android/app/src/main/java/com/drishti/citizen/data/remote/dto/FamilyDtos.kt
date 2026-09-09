package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Family safety circle — ported from `frontend/src/lib/family-api.ts` /
 * `backend/app/schemas/family.py`.
 */
@Serializable
data class FamilyMemberDto(
    val id: Int,
    val name: String,
    val phone: String,
    val relation: String? = null,
    @SerialName("on_drishti") val onDrishti: Boolean = false,
    @SerialName("link_status") val linkStatus: String, // pending | accepted | declined
    // not_registered | invite_pending | invite_declined | in_emergency | needs_help | safe | no_checkin
    val status: String,
    @SerialName("status_label") val statusLabel: String,
    @SerialName("last_check_in_at") val lastCheckInAt: String? = null,
    @SerialName("shares_location") val sharesLocation: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("location_updated_at") val locationUpdatedAt: String? = null,
    @SerialName("distance_km") val distanceKm: Double? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class FamilyRequestDto(
    val id: Int,
    @SerialName("owner_name") val ownerName: String,
    val relation: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class AddFamilyMemberRequest(
    val name: String,
    val phone: String,
    val relation: String? = null,
)

@Serializable
data class FamilyRequestResponse(val accept: Boolean)

@Serializable
data class LocationSharingStateDto(
    val enabled: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class LocationSharingUpdateRequest(val enabled: Boolean)

@Serializable
data class LocationPingRequest(val latitude: Double, val longitude: Double)
