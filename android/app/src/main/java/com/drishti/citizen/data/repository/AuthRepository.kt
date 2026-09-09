package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.safeApiCall
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.AuthResponseDto
import com.drishti.citizen.data.remote.dto.LoginRequest
import com.drishti.citizen.data.remote.dto.RegisterRequest
import javax.inject.Inject

/**
 * Auth calls, ported from `frontend/src/lib/auth-api.ts`. Every failure
 * surfaces as [com.drishti.citizen.core.network.ApiError]; persisting the
 * returned token is [com.drishti.citizen.core.auth.SessionManager]'s job.
 */
class AuthRepository @Inject constructor(
    private val api: ApiService,
) {

    suspend fun login(phone: String, password: String): AuthResponseDto =
        safeApiCall { api.login(LoginRequest(phone = phone, password = password)) }

    suspend fun register(
        name: String,
        phone: String,
        email: String?,
        password: String,
    ): AuthResponseDto = safeApiCall {
        api.register(
            RegisterRequest(name = name, phone = phone, email = email, password = password),
        )
    }
}
