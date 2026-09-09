package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.AlertDto
import kotlinx.serialization.builtins.ListSerializer
import javax.inject.Inject

class AlertsRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    suspend fun alerts(): DataResult<List<AlertDto>> =
        cachedResource(cache, KEY, ListSerializer(AlertDto.serializer())) { api.alerts() }

    private companion object {
        const val KEY = "alerts"
    }
}
