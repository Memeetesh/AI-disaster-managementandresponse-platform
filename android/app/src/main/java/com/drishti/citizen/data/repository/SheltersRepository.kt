package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.NearbyShelterDto
import kotlinx.serialization.builtins.ListSerializer
import javax.inject.Inject

class SheltersRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    suspend fun nearest(at: LatLon, limit: Int = 5): DataResult<List<NearbyShelterDto>> =
        cachedResource(
            cache,
            "shelters/nearest/${at.cacheKey()}/$limit",
            ListSerializer(NearbyShelterDto.serializer()),
        ) { api.nearestShelters(at.lat, at.lon, limit) }
}
