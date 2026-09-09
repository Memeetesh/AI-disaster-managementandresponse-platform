package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `CheckInOut` from `backend/app/schemas/check_in.py`. */
@Serializable
data class CheckInDto(
    val id: Int,
    @SerialName("user_id") val userId: Int,
    val status: String, // safe | need_help
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("created_at") val createdAt: String,
) {
    val isSafe: Boolean get() = status == "safe"
}

@Serializable
data class CheckInRequest(
    val status: String = "safe",
    val latitude: Double? = null,
    val longitude: Double? = null,
)
