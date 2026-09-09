package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.NearbyPlaceDto
import kotlinx.serialization.builtins.ListSerializer
import javax.inject.Inject

class PlacesRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    /** OSM shelter fallback for the Home screen — see `useNearbyPlaces` on the web. */
    suspend fun nearbyShelters(
        at: LatLon,
        radiusKm: Double = 15.0,
        limit: Int = 4,
    ): DataResult<List<NearbyPlaceDto>> = cachedResource(
        cache,
        "places/shelter/${at.cacheKey()}",
        ListSerializer(NearbyPlaceDto.serializer()),
    ) { api.nearbyPlaces(at.lat, at.lon, kind = "shelter", radiusKm = radiusKm, limit = limit) }
}
