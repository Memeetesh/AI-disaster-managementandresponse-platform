package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `GET /shelters/nearest?lat&lon&limit` — server-ranked, with `distance_km`. */
@Serializable
data class NearbyShelterDto(
    val id: Int,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val capacity: Int,
    val occupied: Int,
    val facilities: List<String>? = null,
    val accessibility: String? = null,
    val status: String,
    @SerialName("distance_km") val distanceKm: Double,
)

/**
 * `GET /places/nearby?lat&lon&kind` — real OpenStreetMap points of interest,
 * used as the shelter fallback when there aren't enough registered ones.
 * Returns `[]` when Overpass is unreachable.
 */
@Serializable
data class NearbyPlaceDto(
    val name: String,
    val kind: String, // hospital | shelter | police | fire_station | pharmacy
    val latitude: Double,
    val longitude: Double,
    @SerialName("distance_km") val distanceKm: Double,
    val phone: String? = null,
    val address: String? = null,
)
