package com.drishti.citizen.testing

import com.drishti.citizen.core.cache.CacheHit
import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.data.remote.dto.AuthResponseDto
import com.drishti.citizen.data.remote.dto.AddFamilyMemberRequest
import com.drishti.citizen.data.remote.dto.ChatRequest
import com.drishti.citizen.data.remote.dto.ChatResponseDto
import com.drishti.citizen.data.remote.dto.CheckInDto
import com.drishti.citizen.data.remote.dto.CheckInRequest
import com.drishti.citizen.data.remote.dto.CycloneForecastDto
import com.drishti.citizen.data.remote.dto.FamilyMemberDto
import com.drishti.citizen.data.remote.dto.FamilyRequestDto
import com.drishti.citizen.data.remote.dto.FamilyRequestResponse
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.IncidentDto
import com.drishti.citizen.data.remote.dto.LandslideForecastDto
import com.drishti.citizen.data.remote.dto.LocationPingRequest
import com.drishti.citizen.data.remote.dto.LocationSharingStateDto
import com.drishti.citizen.data.remote.dto.LocationSharingUpdateRequest
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
    override suspend fun incidents(limit: Int?): List<IncidentDto> = error("not stubbed")
    override suspend fun incident(id: Int): IncidentDto = error("not stubbed")
    override suspend fun submitReport(
        latitude: okhttp3.RequestBody,
        longitude: okhttp3.RequestBody,
        type: okhttp3.RequestBody,
        peopleAffected: okhttp3.RequestBody,
        description: okhttp3.RequestBody?,
        image: okhttp3.MultipartBody.Part?,
        audio: okhttp3.MultipartBody.Part?,
    ): IncidentDto = error("not stubbed")
    override suspend fun submitSos(
        latitude: okhttp3.RequestBody,
        longitude: okhttp3.RequestBody,
        peopleAffected: okhttp3.RequestBody,
        description: okhttp3.RequestBody?,
    ): IncidentDto = error("not stubbed")
    override suspend fun createCheckIn(body: CheckInRequest): CheckInDto = error("not stubbed")
    override suspend fun myCheckIn(): CheckInDto? = error("not stubbed")
    override suspend fun family(lat: Double?, lon: Double?): List<FamilyMemberDto> = error("not stubbed")
    override suspend fun addFamilyMember(body: AddFamilyMemberRequest): FamilyMemberDto = error("not stubbed")
    override suspend fun removeFamilyMember(id: Int) = error("not stubbed")
    override suspend fun familyRequests(): List<FamilyRequestDto> = error("not stubbed")
    override suspend fun respondToFamilyRequest(id: Int, body: FamilyRequestResponse) = error("not stubbed")
    override suspend fun locationSharing(): LocationSharingStateDto = error("not stubbed")
    override suspend fun setLocationSharing(body: LocationSharingUpdateRequest): LocationSharingStateDto =
        error("not stubbed")
    override suspend fun pingLocation(body: LocationPingRequest): LocationSharingStateDto = error("not stubbed")
    override suspend fun supportChat(body: ChatRequest): ChatResponseDto = error("not stubbed")
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
