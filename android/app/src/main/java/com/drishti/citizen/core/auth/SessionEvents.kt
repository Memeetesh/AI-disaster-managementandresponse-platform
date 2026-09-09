package com.drishti.citizen.core.auth

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One-way channel from the OkHttp [com.drishti.citizen.core.network.TokenAuthenticator]
 * to [SessionManager]. It exists to break the DI cycle: the authenticator is
 * built into the OkHttp stack that [SessionManager] itself depends on, so it
 * can't depend on the manager directly.
 */
@Singleton
class SessionEvents @Inject constructor() {

    private val _forcedSignOut = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val forcedSignOut: SharedFlow<Unit> = _forcedSignOut.asSharedFlow()

    /** Called off the main thread by the authenticator on a 401. */
    fun notifyForcedSignOut() {
        _forcedSignOut.tryEmit(Unit)
    }
}
