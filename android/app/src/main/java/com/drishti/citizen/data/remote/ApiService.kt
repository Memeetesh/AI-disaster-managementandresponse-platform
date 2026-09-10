package com.drishti.citizen.data.remote

import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.data.remote.dto.AuthResponseDto
import com.drishti.citizen.data.remote.dto.ChatRequest
import com.drishti.citizen.data.remote.dto.ChatResponseDto
import com.drishti.citizen.data.remote.dto.CheckInDto
import com.drishti.citizen.data.remote.dto.CheckInRequest
import com.drishti.citizen.data.remote.dto.AddFamilyMemberRequest
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
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The union of the `frontend/src/lib` API clients. Auth landed in Phase 1;
 * Phase 2 adds the citizen Home surface. Paths are relative to
 * `BuildConfig.BASE_URL` (".../api/v1/").
 */
interface ApiService {

    // --- auth (Phase 1) ---

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponseDto

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponseDto

    @GET("auth/me")
    suspend fun me(): UserDto

    // --- home (Phase 2) ---

    @GET("risk-map")
    suspend fun riskMap(): RiskMapResponseDto

    @GET("alerts")
    suspend fun alerts(): List<AlertDto>

    @GET("shelters/nearest")
    suspend fun nearestShelters(
        @Query("lat") lat: Double,
        @Query("lon") lon: Double,
        @Query("limit") limit: Int = 5,
    ): List<NearbyShelterDto>

    @GET("places/nearby")
    suspend fun nearbyPlaces(
        @Query("lat") lat: Double,
        @Query("lon") lon: Double,
        @Query("kind") kind: String,
        @Query("radius_km") radiusKm: Double? = null,
        @Query("limit") limit: Int? = null,
    ): List<NearbyPlaceDto>

    @GET("weather/rainfall")
    suspend fun rainfall(@Query("lat") lat: Double, @Query("lon") lon: Double): RainfallForecastDto

    @GET("weather/flood")
    suspend fun flood(@Query("lat") lat: Double, @Query("lon") lon: Double): FloodForecastDto

    @GET("weather/cyclone")
    suspend fun cyclone(@Query("lat") lat: Double, @Query("lon") lon: Double): CycloneForecastDto

    @GET("weather/landslide")
    suspend fun landslide(@Query("lat") lat: Double, @Query("lon") lon: Double): LandslideForecastDto

    // --- reports (Phase 3) ---

    /** Citizens get only their own rows server-side. */
    @GET("incidents")
    suspend fun incidents(@Query("limit") limit: Int? = null): List<IncidentDto>

    @GET("incidents/{id}")
    suspend fun incident(@Path("id") id: Int): IncidentDto

    /**
     * `POST /reports` — field names must match `backend/app/api/reports.py`
     * (`type`, not `type_`; the endpoint aliases it).
     */
    @Multipart
    @POST("reports")
    suspend fun submitReport(
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("type") type: RequestBody,
        @Part("people_affected") peopleAffected: RequestBody,
        @Part("description") description: RequestBody?,
        @Part image: MultipartBody.Part?,
        @Part audio: MultipartBody.Part?,
    ): IncidentDto

    // --- emergency (Phase 4) ---

    /** Single-shot emergency submission; defaults to CRITICAL severity server-side. */
    @Multipart
    @POST("sos")
    suspend fun submitSos(
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("people_affected") peopleAffected: RequestBody,
        @Part("description") description: RequestBody?,
    ): IncidentDto

    @POST("check-in")
    suspend fun createCheckIn(@Body body: CheckInRequest): CheckInDto

    /**
     * Raw body because the endpoint returns the literal `null` when the
     * caller has never checked in, which the serialization converter can't
     * decode into `CheckInDto`. Parsed in `CheckInRepository`.
     */
    @GET("check-in/me")
    suspend fun myCheckIn(): ResponseBody

    // --- family (Phase 5) ---

    @GET("family")
    suspend fun family(
        @Query("lat") lat: Double? = null,
        @Query("lon") lon: Double? = null,
    ): List<FamilyMemberDto>

    @POST("family")
    suspend fun addFamilyMember(@Body body: AddFamilyMemberRequest): FamilyMemberDto

    @DELETE("family/{id}")
    suspend fun removeFamilyMember(@Path("id") id: Int)

    @GET("family/requests")
    suspend fun familyRequests(): List<FamilyRequestDto>

    @POST("family/requests/{id}/respond")
    suspend fun respondToFamilyRequest(@Path("id") id: Int, @Body body: FamilyRequestResponse)

    @GET("family/location-sharing")
    suspend fun locationSharing(): LocationSharingStateDto

    @PUT("family/location-sharing")
    suspend fun setLocationSharing(@Body body: LocationSharingUpdateRequest): LocationSharingStateDto

    @POST("family/location-sharing/ping")
    suspend fun pingLocation(@Body body: LocationPingRequest): LocationSharingStateDto

    // --- support (Phase 6) ---

    /** Never errors the client — returns a safe canned reply if the model is down. */
    @POST("chat/support")
    suspend fun supportChat(@Body body: ChatRequest): ChatResponseDto
}
