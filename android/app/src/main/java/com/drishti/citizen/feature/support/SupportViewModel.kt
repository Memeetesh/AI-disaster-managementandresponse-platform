package com.drishti.citizen.feature.support

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.realtime.RealtimeBus
import com.drishti.citizen.core.realtime.RealtimeEvent
import com.drishti.citizen.data.model.SupportSamples
import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.data.remote.dto.ChatMessageDto
import com.drishti.citizen.data.repository.AlertsRepository
import com.drishti.citizen.data.repository.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class ChatRole { USER, ASSISTANT }

data class ChatTurn(val role: ChatRole, val content: String)

data class SupportUiState(
    val alertsLoading: Boolean = true,
    val alertsRefreshing: Boolean = false,
    val alerts: List<AlertDto> = emptyList(),
    val alertsStaleSince: Long? = null,
    val alertsError: String? = null,
    val chat: List<ChatTurn> = listOf(greeting()),
    val chatSending: Boolean = false,
) {
    companion object {
        fun greeting() = ChatTurn(ChatRole.ASSISTANT, SupportSamples.SAATHI_GREETING)
    }
}

@HiltViewModel
class SupportViewModel @Inject constructor(
    private val alertsRepository: AlertsRepository,
    private val chatRepository: ChatRepository,
    realtimeBus: RealtimeBus,
) : ViewModel() {

    private val _state = MutableStateFlow(SupportUiState())
    val state: StateFlow<SupportUiState> = _state.asStateFlow()

    private var pollJob: Job? = null

    init {
        loadAlerts(isRefresh = false)
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(POLL_INTERVAL_MS)
                loadAlerts(isRefresh = true)
            }
        }
        viewModelScope.launch {
            realtimeBus.events.collect { event ->
                if (event == RealtimeEvent.AlertsChanged || event == RealtimeEvent.Reconnected) {
                    loadAlerts(isRefresh = true)
                }
            }
        }
    }

    fun refreshAlerts() = loadAlerts(isRefresh = true)

    private fun loadAlerts(isRefresh: Boolean) {
        _state.update { it.copy(alertsRefreshing = isRefresh) }
        viewModelScope.launch {
            when (val result = alertsRepository.alerts()) {
                is DataResult.Fresh -> _state.update {
                    it.copy(alertsLoading = false, alertsRefreshing = false, alerts = result.data, alertsStaleSince = null, alertsError = null)
                }

                is DataResult.Stale -> _state.update {
                    it.copy(
                        alertsLoading = false, alertsRefreshing = false, alerts = result.data,
                        alertsStaleSince = result.cachedAtEpochMs, alertsError = null,
                    )
                }

                is DataResult.Failure -> _state.update {
                    it.copy(
                        alertsLoading = false, alertsRefreshing = false,
                        alertsError = if (it.alerts.isEmpty()) result.error.message else null,
                    )
                }
            }
        }
    }

    fun sendChat(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _state.value.chatSending) return

        val withUser = _state.value.chat + ChatTurn(ChatRole.USER, trimmed)
        _state.update { it.copy(chat = withUser, chatSending = true) }

        viewModelScope.launch {
            // Send only the real turns — drop the seeded greeting, as the web does.
            val payload = withUser.drop(1).map {
                ChatMessageDto(
                    role = if (it.role == ChatRole.USER) "user" else "assistant",
                    content = it.content,
                )
            }
            val reply = try {
                chatRepository.support(payload).reply
            } catch (_: Exception) {
                SupportSamples.SAATHI_CRISIS_FALLBACK
            }
            _state.update {
                it.copy(chat = it.chat + ChatTurn(ChatRole.ASSISTANT, reply), chatSending = false)
            }
        }
    }

    fun resetChat() = _state.update {
        it.copy(chat = listOf(SupportUiState.greeting()), chatSending = false)
    }

    override fun onCleared() {
        pollJob?.cancel()
    }

    private companion object {
        // Slow backstop only — SSE (alert.*) is the fast path now.
        const val POLL_INTERVAL_MS = 120_000L
    }
}
