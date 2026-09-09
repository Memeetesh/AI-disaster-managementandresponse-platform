package com.drishti.citizen.feature.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.auth.AuthState
import com.drishti.citizen.core.auth.SessionManager
import com.drishti.citizen.core.realtime.RealtimeBus
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RootViewModel @Inject constructor(
    private val sessionManager: SessionManager,
    realtimeBus: RealtimeBus,
) : ViewModel() {

    val authState: StateFlow<AuthState> = sessionManager.state

    /** false while the realtime stream is down — drives the "Reconnecting…" strip. */
    val realtimeConnected: StateFlow<Boolean> = realtimeBus.connected

    fun signOut() {
        viewModelScope.launch { sessionManager.signOut() }
    }
}
