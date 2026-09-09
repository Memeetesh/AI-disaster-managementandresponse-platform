package com.drishti.citizen.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Mirrors `UserRole` in `frontend/src/types/index.ts` /
 * `backend/app/models/enums.py`. Self-registration only ever mints
 * [CITIZEN]; the other roles exist so `/auth/me` deserializes for an
 * account that was provisioned as staff.
 */
@Serializable
enum class UserRole {
    @SerialName("citizen")
    CITIZEN,

    @SerialName("responder")
    RESPONDER,

    @SerialName("admin")
    ADMIN,
}

/** Domain model — the UI layer never sees the wire DTO. */
data class User(
    val id: Int,
    val name: String,
    val phone: String,
    val email: String?,
    val role: UserRole,
)
