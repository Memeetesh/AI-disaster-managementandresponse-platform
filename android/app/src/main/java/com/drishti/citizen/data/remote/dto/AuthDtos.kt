package com.drishti.citizen.data.remote.dto

import com.drishti.citizen.data.model.User
import com.drishti.citizen.data.model.UserRole
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Ported from `backend/app/schemas/user.py` — wire field names are snake_case. */
@Serializable
data class UserDto(
    val id: Int,
    val name: String,
    val phone: String,
    val email: String? = null,
    val role: UserRole,
    @SerialName("created_at") val createdAt: String,
)

/** `POST /auth/login` / `POST /auth/register` response — the `Token` schema. */
@Serializable
data class AuthResponseDto(
    @SerialName("access_token") val accessToken: String,
    @SerialName("token_type") val tokenType: String = "bearer",
    val user: UserDto,
)

@Serializable
data class LoginRequest(
    val phone: String,
    val password: String,
)

/**
 * `role` is deliberately omitted — the server forces `citizen` on
 * self-registration regardless of what the client sends.
 */
@Serializable
data class RegisterRequest(
    val name: String,
    val phone: String,
    val email: String? = null,
    val password: String,
)

fun UserDto.toDomain(): User = User(
    id = id,
    name = name,
    phone = phone,
    email = email,
    role = role,
)
