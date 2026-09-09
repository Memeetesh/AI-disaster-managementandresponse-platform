package com.drishti.citizen.core.network

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * FastAPI errors come back as `{"detail": "..."}` for explicit `HTTPException`s
 * and `{"detail": [{"msg": "...", "loc": [...]}]}` for request-validation
 * failures. Mirrors `extractMessage` in `frontend/src/lib/api.ts`.
 */
object ApiErrorParser {

    private val json = Json { ignoreUnknownKeys = true }

    fun messageFrom(rawBody: String?): String {
        val body = rawBody?.trim().orEmpty()
        if (body.isEmpty()) return ApiError.GENERIC_MESSAGE
        return try {
            when (val detail = json.parseToJsonElement(body).jsonObject["detail"]) {
                is JsonPrimitive -> detail.takeIf { it.isString }?.content ?: ApiError.GENERIC_MESSAGE
                is JsonArray -> (detail.firstOrNull() as? JsonObject)
                    ?.get("msg")?.jsonPrimitive?.content
                    ?: ApiError.GENERIC_MESSAGE
                else -> ApiError.GENERIC_MESSAGE
            }
        } catch (_: Exception) {
            ApiError.GENERIC_MESSAGE
        }
    }
}
