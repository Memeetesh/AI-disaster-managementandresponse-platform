package com.drishti.citizen.data.model

import com.drishti.citizen.data.remote.dto.CycloneForecastDto
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.LandslideForecastDto
import com.drishti.citizen.data.remote.dto.RainfallForecastDto
import com.drishti.citizen.data.remote.dto.RiskZonePropertiesDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RiskCardsTest {

    private fun cards(
        zone: RiskZonePropertiesDto? = null,
        rainfall: RainfallForecastDto? = null,
        flood: FloodForecastDto? = null,
        cyclone: CycloneForecastDto? = null,
        landslide: LandslideForecastDto? = null,
    ) = RiskCards.build(zone, rainfall, flood, cyclone, landslide).associateBy { it.id }

    @Test
    fun `with no data the cards are the static defaults`() {
        val c = cards()
        assertEquals(4, c.size)
        assertTrue(c.values.none { it.live })
        assertEquals("72%", c.getValue("flood").headline)
        assertEquals("chance", c.getValue("rainfall").subtext)
    }

    @Test
    fun `rainfall forecast drives the rainfall card`() {
        val card = cards(
            rainfall = RainfallForecastDto(
                latitude = 13.0, longitude = 80.0, probability = 61,
                rain24hMm = 18.0, rain48hMm = 30.0, currentPrecipitationMm = 2.0,
                level = "high", recommendation = "Carry rain gear",
                trend = listOf(1.0, 2.0, 3.0), source = "open-meteo",
            ),
        ).getValue("rainfall")

        assertTrue(card.live)
        assertEquals(RiskLevel.HIGH, card.level)
        assertEquals("18", card.headline)
        assertEquals("mm next 24h · 61% chance", card.subtext)
        assertEquals("Carry rain gear", card.recommendation)
        assertEquals(listOf(1f, 2f, 3f), card.trend)
    }

    @Test
    fun `resolved risk zone drives the flood card and collapses very_high`() {
        val card = cards(
            zone = RiskZonePropertiesDto(
                id = 4, riskScore = 83.6, riskCategory = "very_high", hazardScore = 0.0,
                populationExposure = 0.0, infrastructureVulnerability = 0.0,
                accessibilityScore = 0.0, historicalRiskScore = 0.0, nearbyIncidentCount = 2,
            ),
        ).getValue("flood")

        assertTrue(card.live)
        assertEquals(RiskLevel.CRITICAL, card.level)
        assertEquals("84%", card.headline)
        assertEquals("risk score", card.subtext)
        assertEquals("Be prepared", card.recommendation)
    }

    @Test
    fun `flood forecast without a zone uses anomaly ratio in the subtext`() {
        val withRiver = cards(flood = flood(anomaly = 2.4)).getValue("flood")
        assertEquals("peak 2.4× normal", withRiver.subtext)
        assertEquals("40%", withRiver.headline)

        val noRiver = cards(flood = flood(anomaly = null)).getValue("flood")
        assertEquals("no major river nearby", noRiver.subtext)
    }

    @Test
    fun `cyclone and landslide forecasts drive their cards`() {
        val c = cards(
            cyclone = CycloneForecastDto(
                latitude = 13.0, longitude = 80.0, cycloneRiskScore = 30,
                peakWindKmh = 70.4, peakGustKmh = 92.7, minPressureHpa = 991.2,
                level = "moderate", recommendation = "Secure loose items",
                trend = listOf(10.0, 20.0), source = "open-meteo",
            ),
            landslide = LandslideForecastDto(
                latitude = 13.0, longitude = 80.0, landslideRiskScore = 44,
                slopeDegrees = 2.1, localReliefM = 5.0, elevationM = 10.0,
                antecedentRainMm = 3.0, forecastRainMm = 8.0, rainTriggerMm = 40.0,
                level = "low", recommendation = "Monitor area",
                trend = listOf(1.0, 2.0), source = "open-meteo",
            ),
        )
        assertEquals("93", c.getValue("cyclone").headline)
        assertTrue(c.getValue("cyclone").subtext.startsWith("km/h peak gusts"))
        assertEquals("44%", c.getValue("landslide").headline)
        assertEquals("flat terrain", c.getValue("landslide").subtext)
        assertFalse(c.getValue("flood").live) // untouched
    }

    private fun flood(anomaly: Double?) = FloodForecastDto(
        latitude = 13.0, longitude = 80.0, floodRiskScore = 40, anomalyRatio = anomaly,
        currentDischargeM3s = 120.0, forecastPeakM3s = 300.0, baselineDischargeM3s = 125.0,
        level = "moderate", recommendation = "Stay alert",
        trend = listOf(100.0, 150.0, 200.0), source = "glofas",
    )
}
