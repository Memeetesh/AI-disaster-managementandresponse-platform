package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.CycloneForecastDto
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.LandslideForecastDto
import com.drishti.citizen.data.remote.dto.RainfallForecastDto
import javax.inject.Inject

class WeatherRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    suspend fun rainfall(at: LatLon): DataResult<RainfallForecastDto> =
        cachedResource(cache, key("rainfall", at), RainfallForecastDto.serializer()) {
            api.rainfall(at.lat, at.lon)
        }

    suspend fun flood(at: LatLon): DataResult<FloodForecastDto> =
        cachedResource(cache, key("flood", at), FloodForecastDto.serializer()) {
            api.flood(at.lat, at.lon)
        }

    suspend fun cyclone(at: LatLon): DataResult<CycloneForecastDto> =
        cachedResource(cache, key("cyclone", at), CycloneForecastDto.serializer()) {
            api.cyclone(at.lat, at.lon)
        }

    suspend fun landslide(at: LatLon): DataResult<LandslideForecastDto> =
        cachedResource(cache, key("landslide", at), LandslideForecastDto.serializer()) {
            api.landslide(at.lat, at.lon)
        }

    private fun key(kind: String, at: LatLon) = "weather/$kind/${at.cacheKey()}"
}
