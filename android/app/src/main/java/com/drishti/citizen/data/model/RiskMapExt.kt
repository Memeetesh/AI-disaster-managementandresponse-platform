package com.drishti.citizen.data.model

import com.drishti.citizen.core.geo.Geo
import com.drishti.citizen.data.remote.dto.RiskMapResponseDto
import com.drishti.citizen.data.remote.dto.RiskZonePropertiesDto

/**
 * The risk zone whose polygon contains the point, or null — ports
 * `findZoneForLocation` in the web citizen Home page.
 */
fun RiskMapResponseDto.zoneAt(lat: Double, lon: Double): RiskZonePropertiesDto? =
    features.firstOrNull { Geo.pointInPolygon(lat, lon, it.geometry.outerRing) }?.properties
