package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.core.network.safeApiCall
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.AddFamilyMemberRequest
import com.drishti.citizen.data.remote.dto.FamilyMemberDto
import com.drishti.citizen.data.remote.dto.FamilyRequestDto
import com.drishti.citizen.data.remote.dto.FamilyRequestResponse
import com.drishti.citizen.data.remote.dto.LocationPingRequest
import com.drishti.citizen.data.remote.dto.LocationSharingStateDto
import com.drishti.citizen.data.remote.dto.LocationSharingUpdateRequest
import kotlinx.serialization.builtins.ListSerializer
import javax.inject.Inject

class FamilyRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    suspend fun family(origin: LatLon?): DataResult<List<FamilyMemberDto>> = cachedResource(
        cache,
        KEY_FAMILY,
        ListSerializer(FamilyMemberDto.serializer()),
    ) { api.family(origin?.lat, origin?.lon) }

    suspend fun requests(): DataResult<List<FamilyRequestDto>> = cachedResource(
        cache,
        KEY_REQUESTS,
        ListSerializer(FamilyRequestDto.serializer()),
    ) { api.familyRequests() }

    suspend fun locationSharing(): DataResult<LocationSharingStateDto> = cachedResource(
        cache,
        KEY_SHARING,
        LocationSharingStateDto.serializer(),
    ) { api.locationSharing() }

    suspend fun addMember(name: String, phone: String, relation: String?): FamilyMemberDto =
        safeApiCall { api.addFamilyMember(AddFamilyMemberRequest(name, phone, relation)) }

    suspend fun removeMember(id: Int) = safeApiCall { api.removeFamilyMember(id) }

    suspend fun respond(id: Int, accept: Boolean) =
        safeApiCall { api.respondToFamilyRequest(id, FamilyRequestResponse(accept)) }

    suspend fun setSharing(enabled: Boolean): LocationSharingStateDto =
        safeApiCall { api.setLocationSharing(LocationSharingUpdateRequest(enabled)) }

    /** Used by the foreground service while sharing is on. */
    suspend fun ping(latitude: Double, longitude: Double): LocationSharingStateDto =
        safeApiCall { api.pingLocation(LocationPingRequest(latitude, longitude)) }

    private companion object {
        const val KEY_FAMILY = "family"
        const val KEY_REQUESTS = "family/requests"
        const val KEY_SHARING = "family/location-sharing"
    }
}
