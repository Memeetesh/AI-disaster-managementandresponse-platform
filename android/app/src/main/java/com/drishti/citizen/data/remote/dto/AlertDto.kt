package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `GET /alerts` — active, unexpired area-wide alerts (`backend/app/schemas/alert.py`). */
@Serializable
data class AlertDto(
    val id: Int,
    val source: String, // imd | sachet | simulator | admin
    val type: String,
    val severity: String, // low | moderate | high | very_high | critical
    val message: String,
    @SerialName("issued_at") val issuedAt: String,
    @SerialName("expires_at") val expiresAt: String? = null,
)
