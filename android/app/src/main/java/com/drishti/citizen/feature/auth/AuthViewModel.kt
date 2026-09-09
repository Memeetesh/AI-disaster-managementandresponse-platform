package com.drishti.citizen.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.auth.SessionManager
import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class AuthMode { LOGIN, REGISTER }

data class AuthUiState(
    val mode: AuthMode = AuthMode.LOGIN,
    val name: String = "",
    val phone: String = "",
    val email: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
) {
    /** Client-side gate; the server is still the authority (phone 6–20, password ≥ 8). */
    val canSubmit: Boolean
        get() = !submitting && when (mode) {
            AuthMode.LOGIN -> phone.isNotBlank() && password.isNotBlank()
            AuthMode.REGISTER -> name.isNotBlank() && phone.isNotBlank() && password.length >= 8
        }
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repository: AuthRepository,
    private val sessionManager: SessionManager,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun setMode(mode: AuthMode) = _state.update {
        if (it.mode == mode) it else it.copy(mode = mode, error = null)
    }

    fun setName(value: String) = _state.update { it.copy(name = value) }
    fun setPhone(value: String) = _state.update { it.copy(phone = value) }
    fun setEmail(value: String) = _state.update { it.copy(email = value) }
    fun setPassword(value: String) = _state.update { it.copy(password = value) }

    fun submit() {
        val current = _state.value
        if (!current.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }

        viewModelScope.launch {
            try {
                val auth = when (current.mode) {
                    AuthMode.LOGIN -> repository.login(
                        phone = current.phone.trim(),
                        password = current.password,
                    )
                    AuthMode.REGISTER -> repository.register(
                        name = current.name.trim(),
                        phone = current.phone.trim(),
                        email = current.email.trim().ifBlank { null },
                        password = current.password,
                    )
                }
                // Root navigation swaps to the app graph off this state change;
                // leave `submitting = true` since the screen is going away.
                sessionManager.signIn(auth)
            } catch (e: ApiError) {
                _state.update { it.copy(submitting = false, error = e.message) }
            } catch (_: Exception) {
                _state.update { it.copy(submitting = false, error = ApiError.GENERIC_MESSAGE) }
            }
        }
    }
}
