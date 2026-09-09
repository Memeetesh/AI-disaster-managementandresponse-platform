package com.drishti.citizen.core.network

import com.drishti.citizen.core.auth.TokenStore
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/** Attaches `Authorization: Bearer <jwt>` when a token is stored — the OkHttp equivalent of `apiFetch`. */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenStore.peek()
        val authed = if (token != null && request.header("Authorization") == null) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        return chain.proceed(authed)
    }
}
