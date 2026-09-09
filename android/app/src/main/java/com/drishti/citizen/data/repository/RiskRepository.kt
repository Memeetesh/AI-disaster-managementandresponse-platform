package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.RiskMapResponseDto
import javax.inject.Inject

class RiskRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    suspend fun riskMap(): DataResult<RiskMapResponseDto> =
        cachedResource(cache, KEY, RiskMapResponseDto.serializer()) { api.riskMap() }

    private companion object {
        const val KEY = "risk-map"
    }
}
