package com.drishti.citizen.core.auth

/**
 * Persists the JWT at rest. [peek] is synchronous because the OkHttp
 * [com.drishti.citizen.core.network.AuthInterceptor] needs the token on a
 * network thread with no coroutine to suspend in.
 */
interface TokenStore {

    fun peek(): String?

    suspend fun save(token: String)

    suspend fun clear()
}
