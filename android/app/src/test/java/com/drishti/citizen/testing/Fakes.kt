package com.drishti.citizen.testing

import com.drishti.citizen.core.cache.CacheHit
import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.data.remote.dto.AuthResponseDto
import com.drishti.citizen.data.remote.dto.CycloneForecastDto
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.LandslideForecastDto
import com.drishti.citizen.data.remote.dto.LoginRequest
import com.drishti.citizen.data.remote.dto.NearbyPlaceDto
import com.drishti.citizen.data.remote.dto.NearbyShelterDto
import com.drishti.citizen.data.remote.dto.RainfallForecastDto
import com.drishti.citizen.data.remote.dto.RegisterRequest
import com.drishti.citizen.data.remote.dto.RiskMapResponseDto
import com.drishti.citizen.data.remote.dto.UserDto
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

/**
 * Every [ApiService] call throws by default — tests subclass and override
 * only the endpoints they exercise.
 */
open class FakeApiService : ApiService {
    override suspend fun register(body: RegisterRequest): AuthResponseDto = error("not stubbed")
    override suspend fun login(body: LoginRequest): AuthResponseDto = error("not stubbed")
    override suspend fun me(): UserDto = error("not stubbed")
    override suspend fun riskMap(): RiskMapResponseDto = error("not stubbed")
    override suspend fun alerts(): List<AlertDto> = error("not stubbed")
    override suspend fun nearestShelters(lat: Double, lon: Double, limit: Int): List<NearbyShelterDto> =
        error("not stubbed")
    override suspend fun nearbyPlaces(
        lat: Double,
        lon: Double,
        kind: String,
        radiusKm: Double?,
        limit: Int?,
    ): List<NearbyPlaceDto> = error("not stubbed")
    override suspend fun rainfall(lat: Double, lon: Double): RainfallForecastDto = error("not stubbed")
    override suspend fun flood(lat: Double, lon: Double): FloodForecastDto = error("not stubbed")
    override suspend fun cyclone(lat: Double, lon: Double): CycloneForecastDto = error("not stubbed")
    override suspend fun landslide(lat: Double, lon: Double): LandslideForecastDto = error("not stubbed")
}

/** In-memory [ResponseCache] backed by the real [Json] so round-trips are exercised. */
class FakeResponseCache(
    private val json: Json = Json { ignoreUnknownKeys = true; explicitNulls = false },
    var now: () -> Long = { 0L },
) : ResponseCache {

    private data class Row(val json: String, val at: Long)

    private val store = mutableMapOf<String, Row>()

    override suspend fun <T> load(key: String, serializer: KSerializer<T>): CacheHit<T>? {
        val row = store[key] ?: return null
        return runCatching { json.decodeFromString(serializer, row.json) }
            .map { CacheHit(it, row.at) }
            .getOrNull()
    }

    override suspend fun <T> save(key: String, serializer: KSerializer<T>, value: T) {
        store[key] = Row(json.encodeToString(serializer, value), now())
    }

    override suspend fun clear() = store.clear()
}
