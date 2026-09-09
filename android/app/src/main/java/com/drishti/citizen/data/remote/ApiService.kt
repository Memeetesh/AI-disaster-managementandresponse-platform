package com.drishti.citizen.data.remote

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
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
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
}
