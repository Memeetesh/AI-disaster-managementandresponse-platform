package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.core.network.safeApiCall
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.CheckInDto
import com.drishti.citizen.data.remote.dto.CheckInRequest
import kotlinx.serialization.builtins.nullable
import javax.inject.Inject

class CheckInRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    /** The caller's latest check-in (or null), cached so the button state survives offline. */
    suspend fun myCheckIn(): DataResult<CheckInDto?> =
        cachedResource(cache, KEY, CheckInDto.serializer().nullable) { api.myCheckIn() }

    suspend fun markSafe(latitude: Double?, longitude: Double?): CheckInDto = safeApiCall {
        api.createCheckIn(CheckInRequest(status = "safe", latitude = latitude, longitude = longitude))
    }

    private companion object {
        const val KEY = "check-in/me"
    }
}
