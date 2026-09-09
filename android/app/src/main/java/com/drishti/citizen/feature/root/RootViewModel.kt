package com.drishti.citizen.feature.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.auth.AuthState
import com.drishti.citizen.core.auth.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RootViewModel @Inject constructor(
    private val sessionManager: SessionManager,
) : ViewModel() {

    val authState: StateFlow<AuthState> = sessionManager.state

    fun signOut() {
        viewModelScope.launch { sessionManager.signOut() }
    }
}
