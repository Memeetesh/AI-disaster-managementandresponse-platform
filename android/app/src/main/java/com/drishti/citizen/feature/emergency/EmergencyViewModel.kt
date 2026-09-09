package com.drishti.citizen.feature.emergency

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.location.LocationProvider
import com.drishti.citizen.core.location.LocationUiState
import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.core.sos.SosQueue
import com.drishti.citizen.data.remote.dto.CheckInDto
import com.drishti.citizen.data.remote.dto.NearbyPlaceDto
import com.drishti.citizen.data.remote.dto.NearbyShelterDto
import com.drishti.citizen.data.repository.CheckInRepository
import com.drishti.citizen.data.repository.IncidentsRepository
import com.drishti.citizen.data.repository.PlacesRepository
import com.drishti.citizen.data.repository.SheltersRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface SosStage {
    data object Idle : SosStage

    /** Finger down on the button; [progress] runs 0f‥1f over the hold window. */
    data class Holding(val progress: Float) : SosStage

    data object Submitting : SosStage
    data class Sent(val incidentId: Int) : SosStage

    /** Network was down — handed to WorkManager, not yet delivered. */
    data object Queued : SosStage
    data class Failed(val message: String) : SosStage
}

data class EmergencyUiState(
    val location: LocationUiState = LocationUiState.Locating,
    val sos: SosStage = SosStage.Idle,
    val nearestHospital: NearbyPlaceDto? = null,
    val nearestRescue: NearbyShelterDto? = null,
    val placesLoading: Boolean = true,
    val checkIn: CheckInDto? = null,
    val checkInSubmitting: Boolean = false,
    val checkInMessage: String? = null,
)

@HiltViewModel
class EmergencyViewModel @Inject constructor(
    private val locationProvider: LocationProvider,
    private val incidentsRepository: IncidentsRepository,
    private val checkInRepository: CheckInRepository,
    private val placesRepository: PlacesRepository,
    private val sheltersRepository: SheltersRepository,
    private val sosQueue: SosQueue,
) : ViewModel() {

    private val _state = MutableStateFlow(EmergencyUiState())
    val state: StateFlow<EmergencyUiState> = _state.asStateFlow()

    private var holdJob: Job? = null

    init {
        resolveLocationAndLoad()
    }

    fun onLocationPermissionResult() = resolveLocationAndLoad()

    private fun resolveLocationAndLoad() {
        if (!locationProvider.hasPermission()) {
            _state.update { it.copy(location = LocationUiState.PermissionNeeded, placesLoading = false) }
            loadCheckIn()
            return
        }
        _state.update { it.copy(location = LocationUiState.Locating) }
        viewModelScope.launch {
            val fix = locationProvider.currentFix()
            _state.update {
                it.copy(location = fix?.let(LocationUiState::Ready) ?: LocationUiState.Unavailable)
            }
            loadNearby(fix)
            loadCheckIn()
        }
    }

    private suspend fun loadNearby(fix: LatLon?) {
        if (fix == null) {
            _state.update { it.copy(placesLoading = false) }
            return
        }
        coroutineScope {
            val hospitals = async { placesRepository.nearbyHospitals(fix) }
            val shelters = async { sheltersRepository.nearest(fix, limit = 5) }
            _state.update {
                it.copy(
                    placesLoading = false,
                    nearestHospital = hospitals.await().dataOrNull?.firstOrNull(),
                    nearestRescue = shelters.await().dataOrNull?.firstOrNull(),
                )
            }
        }
    }

    private fun loadCheckIn() {
        viewModelScope.launch {
            _state.update { it.copy(checkIn = checkInRepository.myCheckIn().dataOrNull) }
        }
    }

    // --- hold-to-send ---

    fun startHold() {
        val s = _state.value
        if (s.location !is LocationUiState.Ready) return
        if (s.sos is SosStage.Holding || s.sos is SosStage.Submitting || s.sos is SosStage.Sent) return

        holdJob?.cancel()
        holdJob = viewModelScope.launch {
            var elapsed = 0L
            while (elapsed < HOLD_DURATION_MS) {
                delay(HOLD_STEP_MS)
                elapsed += HOLD_STEP_MS
                _state.update {
                    it.copy(sos = SosStage.Holding((elapsed.toFloat() / HOLD_DURATION_MS).coerceIn(0f, 1f)))
                }
            }
            submitSos()
        }
    }

    fun cancelHold() {
        holdJob?.cancel()
        holdJob = null
        if (_state.value.sos is SosStage.Holding) {
            _state.update { it.copy(sos = SosStage.Idle) }
        }
    }

    fun dismissSosResult() {
        _state.update { it.copy(sos = SosStage.Idle) }
    }

    private fun submitSos() {
        val fix = (_state.value.location as? LocationUiState.Ready)?.at ?: return
        _state.update { it.copy(sos = SosStage.Submitting) }
        viewModelScope.launch {
            try {
                val incident = incidentsRepository.submitSos(
                    latitude = fix.lat,
                    longitude = fix.lon,
                    peopleAffected = 1,
                    description = SOS_DESCRIPTION,
                )
                _state.update { it.copy(sos = SosStage.Sent(incident.id)) }
            } catch (e: ApiError) {
                if (e.isNetwork) {
                    sosQueue.enqueue(fix.lat, fix.lon, 1, SOS_DESCRIPTION)
                    _state.update { it.copy(sos = SosStage.Queued) }
                } else {
                    _state.update { it.copy(sos = SosStage.Failed(e.message)) }
                }
            } catch (_: Exception) {
                _state.update { it.copy(sos = SosStage.Failed(ApiError.GENERIC_MESSAGE)) }
            }
        }
    }

    // --- "I am Safe" ---

    fun markSafe() {
        if (_state.value.checkInSubmitting) return
        val fix = (_state.value.location as? LocationUiState.Ready)?.at
        _state.update { it.copy(checkInSubmitting = true, checkInMessage = null) }
        viewModelScope.launch {
            try {
                val checkIn = checkInRepository.markSafe(fix?.lat, fix?.lon)
                _state.update {
                    it.copy(
                        checkInSubmitting = false,
                        checkIn = checkIn,
                        checkInMessage = "You're marked as safe. Your approximate area was shared.",
                    )
                }
            } catch (e: ApiError) {
                _state.update { it.copy(checkInSubmitting = false, checkInMessage = e.message) }
            } catch (_: Exception) {
                _state.update {
                    it.copy(checkInSubmitting = false, checkInMessage = "Couldn't send your check-in. Try again.")
                }
            }
        }
    }

    fun consumeCheckInMessage() = _state.update { it.copy(checkInMessage = null) }

    override fun onCleared() {
        holdJob?.cancel()
    }

    private companion object {
        const val HOLD_DURATION_MS = 3_000L
        const val HOLD_STEP_MS = 50L
        const val SOS_DESCRIPTION = "Emergency SOS sent from the DRISHTI app."
    }
}
