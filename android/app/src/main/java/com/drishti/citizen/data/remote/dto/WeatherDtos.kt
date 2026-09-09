package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `GET /weather/{rainfall,flood,cyclone,landslide}?lat&lon` — location
 * forecasts (`backend/app/schemas/weather.py`). `level` is one of
 * low | moderate | high | critical.
 */

@Serializable
data class RainfallForecastDto(
    val latitude: Double,
    val longitude: Double,
    val probability: Int,
    @SerialName("rain_24h_mm") val rain24hMm: Double,
    @SerialName("rain_48h_mm") val rain48hMm: Double,
    @SerialName("current_precipitation_mm") val currentPrecipitationMm: Double,
    val level: String,
    val recommendation: String,
    val trend: List<Double> = emptyList(),
    val source: String,
)

@Serializable
data class FloodForecastDto(
    val latitude: Double,
    val longitude: Double,
    @SerialName("flood_risk_score") val floodRiskScore: Int,
    @SerialName("anomaly_ratio") val anomalyRatio: Double? = null,
    @SerialName("current_discharge_m3s") val currentDischargeM3s: Double,
    @SerialName("forecast_peak_m3s") val forecastPeakM3s: Double,
    @SerialName("baseline_discharge_m3s") val baselineDischargeM3s: Double,
    val level: String,
    val recommendation: String,
    val trend: List<Double> = emptyList(),
    val source: String,
)

@Serializable
data class CycloneForecastDto(
    val latitude: Double,
    val longitude: Double,
    @SerialName("cyclone_risk_score") val cycloneRiskScore: Int,
    @SerialName("peak_wind_kmh") val peakWindKmh: Double,
    @SerialName("peak_gust_kmh") val peakGustKmh: Double,
    @SerialName("min_pressure_hpa") val minPressureHpa: Double? = null,
    val level: String,
    val recommendation: String,
    val trend: List<Double> = emptyList(),
    val source: String,
)

@Serializable
data class LandslideForecastDto(
    val latitude: Double,
    val longitude: Double,
    @SerialName("landslide_risk_score") val landslideRiskScore: Int,
    @SerialName("slope_degrees") val slopeDegrees: Double,
    @SerialName("local_relief_m") val localReliefM: Double,
    @SerialName("elevation_m") val elevationM: Double,
    @SerialName("antecedent_rain_mm") val antecedentRainMm: Double,
    @SerialName("forecast_rain_mm") val forecastRainMm: Double,
    @SerialName("rain_trigger_mm") val rainTriggerMm: Double,
    val level: String,
    val recommendation: String,
    val trend: List<Double> = emptyList(),
    val source: String,
)
