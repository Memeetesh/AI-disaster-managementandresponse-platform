package com.drishti.citizen.data.repository

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.cachedResource
import com.drishti.citizen.core.network.safeApiCall
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.IncidentDto
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

class IncidentsRepository @Inject constructor(
    private val api: ApiService,
    private val cache: ResponseCache,
) {
    /** The signed-in citizen's own reports (server-scoped), cached for offline reads. */
    suspend fun myReports(): DataResult<List<IncidentDto>> =
        cachedResource(cache, KEY_MINE, ListSerializer(IncidentDto.serializer())) { api.incidents() }

    /** A single incident — used to poll the confirmation screen for status changes. */
    suspend fun incident(id: Int): IncidentDto = safeApiCall { api.incident(id) }

    /** `POST /sos` — no media on the emergency path (matches the web SOS modal). */
    suspend fun submitSos(
        latitude: Double,
        longitude: Double,
        peopleAffected: Int,
        description: String?,
    ): IncidentDto = safeApiCall {
        api.submitSos(
            latitude = latitude.toString().toPlainPart(),
            longitude = longitude.toString().toPlainPart(),
            peopleAffected = peopleAffected.toString().toPlainPart(),
            description = description?.takeIf { it.isNotBlank() }?.toPlainPart(),
        )
    }

    /** `POST /reports`. Media parts are built by the caller (they need a `ContentResolver`). */
    suspend fun submitReport(
        latitude: Double,
        longitude: Double,
        type: String,
        peopleAffected: Int,
        description: String?,
        image: MultipartBody.Part?,
        audio: MultipartBody.Part?,
    ): IncidentDto = safeApiCall {
        api.submitReport(
            latitude = latitude.toString().toPlainPart(),
            longitude = longitude.toString().toPlainPart(),
            type = type.toPlainPart(),
            peopleAffected = peopleAffected.toString().toPlainPart(),
            description = description?.takeIf { it.isNotBlank() }?.toPlainPart(),
            image = image,
            audio = audio,
        )
    }

    private fun String.toPlainPart(): RequestBody = toRequestBody(PLAIN_TEXT)

    private companion object {
        const val KEY_MINE = "incidents/mine"
        val PLAIN_TEXT = "text/plain".toMediaType()
    }
}
