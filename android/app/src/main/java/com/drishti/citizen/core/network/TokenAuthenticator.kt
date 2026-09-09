package com.drishti.citizen.core.network

import com.drishti.citizen.core.auth.SessionEvents
import com.drishti.citizen.core.auth.TokenStore
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tokens are 24h with no refresh endpoint (`backend/app/config.py`), so a 401
 * on an authenticated request means the session is dead: clear it and tell
 * [SessionManager][com.drishti.citizen.core.auth.SessionManager] to route
 * back to the auth screen. Returning null = don't retry.
 *
 * A 401 from `/auth/login` or `/auth/register` is just bad credentials — it
 * flows back to the caller as an [ApiError] and must not trip a sign-out.
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val sessionEvents: SessionEvents,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        val path = response.request.url.encodedPath
        if (path.endsWith("/auth/login") || path.endsWith("/auth/register")) return null

        runBlocking { tokenStore.clear() }
        sessionEvents.notifyForcedSignOut()
        return null
    }
}
