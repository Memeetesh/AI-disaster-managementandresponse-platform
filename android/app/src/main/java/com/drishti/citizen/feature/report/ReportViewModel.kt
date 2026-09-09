package com.drishti.citizen.feature.report

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.location.LocationProvider
import com.drishti.citizen.core.location.LocationUiState
import com.drishti.citizen.core.media.MediaPartFactory
import com.drishti.citizen.core.media.VoiceRecorder
import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.core.realtime.RealtimeBus
import com.drishti.citizen.core.realtime.RealtimeEvent
import com.drishti.citizen.data.model.IncidentType
import com.drishti.citizen.data.repository.IncidentsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class ReportResult(
    val id: Int,
    val severity: String,
    val status: String,
    /** true once a responder has moved it past "under review". */
    val settledByResponder: Boolean = false,
)

data class ReportUiState(
    val type: IncidentType = IncidentType.FLOOD,
    val peopleAffected: Int = 0,
    val description: String = "",
    val imageUri: Uri? = null,
    val recording: Boolean = false,
    val audioFile: File? = null,
    val location: LocationUiState = LocationUiState.Locating,
    val submitting: Boolean = false,
    val error: String? = null,
    val result: ReportResult? = null,
) {
    val canSubmit: Boolean get() = !submitting && !recording && location is LocationUiState.Ready
}

@HiltViewModel
class ReportViewModel @Inject constructor(
    private val locationProvider: LocationProvider,
    private val incidentsRepository: IncidentsRepository,
    private val mediaPartFactory: MediaPartFactory,
    private val voiceRecorder: VoiceRecorder,
    realtimeBus: RealtimeBus,
) : ViewModel() {

    private val _state = MutableStateFlow(ReportUiState())
    val state: StateFlow<ReportUiState> = _state.asStateFlow()

    private var pollJob: Job? = null

    init {
        resolveLocation()
        viewModelScope.launch {
            realtimeBus.events.collect { event ->
                val id = _state.value.result?.id ?: return@collect
                if (event is RealtimeEvent.IncidentChanged) refreshIncidentStatus(id)
            }
        }
    }

    fun onLocationPermissionResult() = resolveLocation()

    private fun resolveLocation() {
        if (!locationProvider.hasPermission()) {
            _state.update { it.copy(location = LocationUiState.PermissionNeeded) }
            return
        }
        _state.update { it.copy(location = LocationUiState.Locating) }
        viewModelScope.launch {
            val fix = locationProvider.currentFix()
            _state.update {
                it.copy(location = fix?.let(LocationUiState::Ready) ?: LocationUiState.Unavailable)
            }
        }
    }

    fun setType(type: IncidentType) = _state.update { it.copy(type = type) }
    fun setPeopleAffected(count: Int) = _state.update { it.copy(peopleAffected = count.coerceAtLeast(0)) }
    fun setDescription(text: String) = _state.update { it.copy(description = text) }

    fun setImage(uri: Uri?) = _state.update { it.copy(imageUri = uri) }

    fun startRecording() {
        if (voiceRecorder.start()) {
            _state.update { it.copy(recording = true, error = null) }
        } else {
            _state.update { it.copy(error = "Couldn't start recording. Check the microphone permission.") }
        }
    }

    fun stopRecording() {
        val file = voiceRecorder.stop()
        _state.update { it.copy(recording = false, audioFile = file) }
    }

    fun discardAudio() {
        voiceRecorder.discard(_state.value.audioFile)
        _state.update { it.copy(audioFile = null) }
    }

    fun submit() {
        val current = _state.value
        val location = current.location
        if (!current.canSubmit || location !is LocationUiState.Ready) return

        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            val imagePart = try {
                current.imageUri?.let { mediaPartFactory.imagePart(it) }
            } catch (_: Exception) {
                _state.update {
                    it.copy(submitting = false, error = "Couldn't attach the photo. Try a different image.")
                }
                return@launch
            }
            val audioPart = current.audioFile?.let(mediaPartFactory::audioPart)

            try {
                val incident = incidentsRepository.submitReport(
                    latitude = location.at.lat,
                    longitude = location.at.lon,
                    type = current.type.wire,
                    peopleAffected = current.peopleAffected,
                    description = current.description.trim().ifBlank { null },
                    image = imagePart,
                    audio = audioPart,
                )
                _state.update {
                    it.copy(
                        submitting = false,
                        result = ReportResult(incident.id, incident.severity, incident.status),
                    )
                }
                pollStatus(incident.id)
            } catch (e: ApiError) {
                _state.update { it.copy(submitting = false, error = e.message) }
            } catch (_: Exception) {
                _state.update { it.copy(submitting = false, error = ApiError.GENERIC_MESSAGE) }
            }
        }
    }

    private fun pollStatus(id: Int) {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            repeat(MAX_POLLS) {
                delay(POLL_INTERVAL_MS)
                if (refreshIncidentStatus(id)) return@launch // settled
            }
        }
    }

    /** Fetches the incident once and patches the confirmation card. Returns true if it's now settled. */
    private suspend fun refreshIncidentStatus(id: Int): Boolean {
        val fresh = runCatching { incidentsRepository.incident(id) }.getOrNull() ?: return false
        val terminal = fresh.status in TERMINAL_STATUSES
        _state.update { s ->
            s.copy(
                result = s.result?.copy(
                    severity = fresh.severity,
                    status = fresh.status,
                    settledByResponder = terminal,
                ),
            )
        }
        return terminal
    }

    override fun onCleared() {
        pollJob?.cancel()
        voiceRecorder.cancel()
    }

    private companion object {
        const val POLL_INTERVAL_MS = 5_000L
        const val MAX_POLLS = 24 // ~2 minutes
        val TERMINAL_STATUSES = setOf("verified", "rejected", "in_progress", "resolved")
    }
}
