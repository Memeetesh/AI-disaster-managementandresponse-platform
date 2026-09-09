package com.drishti.citizen.data.model

import com.drishti.citizen.data.remote.dto.CycloneForecastDto
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.LandslideForecastDto
import com.drishti.citizen.data.remote.dto.RainfallForecastDto
import com.drishti.citizen.data.remote.dto.RiskZonePropertiesDto
import java.util.Locale
import kotlin.math.roundToInt

/** Citizen UI's 4-band scale (the risk engine's `very_high` collapses onto `critical`). */
enum class RiskLevel { LOW, MODERATE, HIGH, CRITICAL }

data class RiskCard(
    val id: String, // rainfall | flood | cyclone | landslide
    val title: String,
    val level: RiskLevel,
    val headline: String,
    val subtext: String,
    val trend: List<Float>,
    val recommendation: String,
    val live: Boolean,
)

/**
 * Ports the `riskCards` computation in the web citizen Home page: start from
 * the static demo cards, then overlay live location forecasts / the resolved
 * risk zone where available.
 */
object RiskCards {

    private data class Defaults(
        val id: String,
        val title: String,
        val level: RiskLevel,
        val probability: Int,
        val recommendation: String,
        val trend: List<Float>,
    )

    // Mirrors `frontend/src/data/citizen-mock.ts`.
    private val DEFAULTS = listOf(
        Defaults("rainfall", "Rainfall Prediction", RiskLevel.MODERATE, 58, "Stay alert", listOf(30f, 35f, 42f, 48f, 52f, 58f, 55f)),
        Defaults("flood", "Flood Prediction", RiskLevel.HIGH, 72, "Be prepared", listOf(40f, 45f, 50f, 58f, 65f, 70f, 72f)),
        Defaults("cyclone", "Cyclone Prediction", RiskLevel.LOW, 12, "No threat", listOf(15f, 14f, 13f, 12f, 11f, 12f, 12f)),
        Defaults("landslide", "Landslide Prediction", RiskLevel.MODERATE, 45, "Monitor area", listOf(20f, 25f, 30f, 35f, 40f, 43f, 45f)),
    )

    fun build(
        currentZone: RiskZonePropertiesDto?,
        rainfall: RainfallForecastDto?,
        flood: FloodForecastDto?,
        cyclone: CycloneForecastDto?,
        landslide: LandslideForecastDto?,
    ): List<RiskCard> = DEFAULTS.map { d ->
        when (d.id) {
            "rainfall" -> rainfallCard(d, rainfall)
            "flood" -> floodCard(d, currentZone, flood)
            "cyclone" -> cycloneCard(d, cyclone)
            "landslide" -> landslideCard(d, landslide)
            else -> d.fallback()
        }
    }

    private fun rainfallCard(d: Defaults, f: RainfallForecastDto?): RiskCard {
        if (f == null) return d.fallback()
        return RiskCard(
            id = d.id,
            title = d.title,
            level = levelOf(f.level),
            headline = compact(f.rain24hMm),
            subtext = "mm next 24h · ${f.probability}% chance",
            trend = trendOr(f.trend, d.trend),
            recommendation = f.recommendation,
            live = true,
        )
    }

    private fun floodCard(d: Defaults, zone: RiskZonePropertiesDto?, f: FloodForecastDto?): RiskCard {
        if (zone != null) {
            return RiskCard(
                id = d.id,
                title = d.title,
                level = citizenLevelOf(zone.riskCategory),
                headline = "${zone.riskScore.roundToInt()}%",
                subtext = "risk score",
                trend = d.trend,
                recommendation = when (zone.riskCategory) {
                    "low" -> "No action needed"
                    "moderate" -> "Stay alert"
                    else -> "Be prepared"
                },
                live = true,
            )
        }
        if (f == null) return d.fallback()
        return RiskCard(
            id = d.id,
            title = d.title,
            level = levelOf(f.level),
            headline = "${f.floodRiskScore}%",
            subtext = when {
                f.anomalyRatio != null -> "peak ${compact(f.anomalyRatio)}× normal"
                else -> "no major river nearby"
            },
            trend = trendOr(f.trend, d.trend),
            recommendation = f.recommendation,
            live = true,
        )
    }

    private fun cycloneCard(d: Defaults, f: CycloneForecastDto?): RiskCard {
        if (f == null) return d.fallback()
        val pressure = f.minPressureHpa?.let { " · min ${it.roundToInt()} hPa" }.orEmpty()
        return RiskCard(
            id = d.id,
            title = d.title,
            level = levelOf(f.level),
            headline = "${f.peakGustKmh.roundToInt()}",
            subtext = "km/h peak gusts$pressure",
            trend = trendOr(f.trend, d.trend),
            recommendation = f.recommendation,
            live = true,
        )
    }

    private fun landslideCard(d: Defaults, f: LandslideForecastDto?): RiskCard {
        if (f == null) return d.fallback()
        return RiskCard(
            id = d.id,
            title = d.title,
            level = levelOf(f.level),
            headline = "${f.landslideRiskScore}%",
            subtext = if (f.slopeDegrees < 6) {
                "flat terrain"
            } else {
                "slope ${f.slopeDegrees.roundToInt()}° · ${f.rainTriggerMm.roundToInt()} mm rain"
            },
            trend = trendOr(f.trend, d.trend),
            recommendation = f.recommendation,
            live = true,
        )
    }

    private fun Defaults.fallback() = RiskCard(
        id = id,
        title = title,
        level = level,
        headline = "$probability%",
        subtext = "chance",
        trend = trend,
        recommendation = recommendation,
        live = false,
    )

    private fun levelOf(raw: String): RiskLevel = when (raw.lowercase(Locale.US)) {
        "low" -> RiskLevel.LOW
        "high" -> RiskLevel.HIGH
        "critical" -> RiskLevel.CRITICAL
        else -> RiskLevel.MODERATE
    }

    private fun citizenLevelOf(category: String): RiskLevel = when (category.lowercase(Locale.US)) {
        "low" -> RiskLevel.LOW
        "high" -> RiskLevel.HIGH
        "very_high", "critical" -> RiskLevel.CRITICAL
        else -> RiskLevel.MODERATE
    }

    private fun trendOr(live: List<Double>, fallback: List<Float>): List<Float> =
        if (live.size > 1) live.map { it.toFloat() } else fallback

    private fun compact(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString()
        else String.format(Locale.US, "%.1f", value)
}
