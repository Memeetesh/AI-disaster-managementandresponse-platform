package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `GET /risk-map` — a GeoJSON `FeatureCollection`, one polygon per grid cell
 * (`backend/app/schemas/risk_zone.py`). Ported from `RiskMapResponse` in
 * `frontend/src/types/index.ts`.
 */
@Serializable
data class RiskMapResponseDto(
    val type: String = "FeatureCollection",
    val features: List<RiskZoneFeatureDto> = emptyList(),
)

@Serializable
data class RiskZoneFeatureDto(
    val type: String = "Feature",
    val geometry: GeoJsonPolygonDto,
    val properties: RiskZonePropertiesDto,
)

@Serializable
data class GeoJsonPolygonDto(
    val type: String = "Polygon",
    /** `[[[lon, lat], ...]]` — outer ring first; demo cells have no holes. */
    val coordinates: List<List<List<Double>>> = emptyList(),
) {
    /** Outer ring, or empty. */
    val outerRing: List<List<Double>> get() = coordinates.firstOrNull().orEmpty()
}

@Serializable
data class RiskZonePropertiesDto(
    val id: Int,
    @SerialName("risk_score") val riskScore: Double,
    @SerialName("risk_category") val riskCategory: String,
    @SerialName("hazard_score") val hazardScore: Double,
    @SerialName("population_exposure") val populationExposure: Double,
    @SerialName("infrastructure_vulnerability") val infrastructureVulnerability: Double,
    @SerialName("accessibility_score") val accessibilityScore: Double,
    @SerialName("historical_risk_score") val historicalRiskScore: Double,
    @SerialName("nearby_incident_count") val nearbyIncidentCount: Int,
)
