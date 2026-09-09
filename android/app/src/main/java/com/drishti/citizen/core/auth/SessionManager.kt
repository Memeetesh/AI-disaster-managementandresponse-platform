package com.drishti.citizen.core.auth

import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.di.AppScope
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.AuthResponseDto
import com.drishti.citizen.data.remote.dto.toDomain
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single source of truth for "who is signed in". Mirrors the web
 * `AuthProvider`: on launch, read the stored token and re-validate it against
 * `GET /auth/me` rather than trusting a cached role; drop it on any failure.
 */
@Singleton
class SessionManager @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val responseCache: ResponseCache,
    sessionEvents: SessionEvents,
    @AppScope private val scope: CoroutineScope,
) {

    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        // A 401 anywhere in the app clears the session.
        scope.launch {
            sessionEvents.forcedSignOut.collect { clearSession() }
        }
        scope.launch { bootstrap() }
    }

    private suspend fun bootstrap() {
        val token = tokenStore.peek()
        if (token == null) {
            _state.value = AuthState.SignedOut
            return
        }
        _state.value = try {
            AuthState.SignedIn(api.me().toDomain())
        } catch (_: Exception) {
            // Matches the web: any validation failure drops the token.
            // TODO(phase 7): tolerate a transient network error here instead
            //  of forcing a re-login when the backend is briefly unreachable.
            tokenStore.clear()
            AuthState.SignedOut
        }
    }

    suspend fun signIn(auth: AuthResponseDto) {
        tokenStore.save(auth.accessToken)
        _state.value = AuthState.SignedIn(auth.user.toDomain())
    }

    suspend fun signOut() = clearSession()

    private suspend fun clearSession() {
        tokenStore.clear()
        runCatching { responseCache.clear() } // stale snapshots must not leak to the next account
        _state.value = AuthState.SignedOut
    }
}
