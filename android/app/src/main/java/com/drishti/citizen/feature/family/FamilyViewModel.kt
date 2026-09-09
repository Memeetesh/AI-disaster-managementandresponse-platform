package com.drishti.citizen.feature.family

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.familyshare.LocationSharingService
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.location.LocationProvider
import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.realtime.RealtimeBus
import com.drishti.citizen.core.realtime.RealtimeEvent
import com.drishti.citizen.data.model.FamilyCounts
import com.drishti.citizen.data.model.FamilyMembers
import com.drishti.citizen.data.remote.dto.FamilyMemberDto
import com.drishti.citizen.data.remote.dto.FamilyRequestDto
import com.drishti.citizen.data.repository.FamilyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FamilyUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val members: List<FamilyMemberDto> = emptyList(),
    val requests: List<FamilyRequestDto> = emptyList(),
    val counts: FamilyCounts = FamilyCounts(0, 0, 0),
    val sharingEnabled: Boolean = false,
    val sharingUpdatedAt: String? = null,
    val sharingBusy: Boolean = false,
    val locationGranted: Boolean = false,
    val addBusy: Boolean = false,
    val staleSinceEpochMs: Long? = null,
    val error: String? = null,
    val message: String? = null,
)

@HiltViewModel
class FamilyViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: FamilyRepository,
    private val locationProvider: LocationProvider,
    realtimeBus: RealtimeBus,
) : ViewModel() {

    private val _state = MutableStateFlow(FamilyUiState())
    val state: StateFlow<FamilyUiState> = _state.asStateFlow()

    private var origin: LatLon? = null
    private var pollJob: Job? = null

    init {
        _state.update { it.copy(locationGranted = locationProvider.hasPermission()) }
        bootstrap()
        startPolling()
        viewModelScope.launch {
            realtimeBus.events.collect { event ->
                when (event) {
                    RealtimeEvent.FamilyUpdated -> loadFamilyAndRequests()
                    RealtimeEvent.Reconnected -> loadAll(fresh = false)
                    else -> Unit
                }
            }
        }
    }

    fun refresh() {
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch { loadAll(fresh = true) }
    }

    fun onLocationPermissionResult() {
        _state.update { it.copy(locationGranted = locationProvider.hasPermission()) }
        bootstrap()
    }

    private fun bootstrap() {
        viewModelScope.launch {
            if (locationProvider.hasPermission()) {
                origin = locationProvider.currentFix()
            }
            loadAll(fresh = false)
            // Re-attach the service if the server says we were sharing (e.g. after a restart).
            if (_state.value.sharingEnabled && locationProvider.hasPermission()) {
                LocationSharingService.start(context)
            }
        }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(POLL_INTERVAL_MS)
                loadFamilyAndRequests()
            }
        }
    }

    private suspend fun loadAll(fresh: Boolean) {
        val familyResult = repository.family(origin)
        val requestsResult = repository.requests()
        val sharingResult = repository.locationSharing()

        val results = listOf(familyResult, requestsResult, sharingResult)
        val staleSince = results.filterIsInstance<DataResult.Stale<*>>().minOfOrNull { it.cachedAtEpochMs }
        val allFailed = results.all { it is DataResult.Failure }

        val members = familyResult.dataOrNull.orEmpty()
        val sharing = sharingResult.dataOrNull

        _state.update {
            it.copy(
                loading = false,
                refreshing = false,
                members = members,
                requests = requestsResult.dataOrNull.orEmpty(),
                counts = FamilyMembers.counts(members),
                sharingEnabled = sharing?.enabled ?: it.sharingEnabled,
                sharingUpdatedAt = sharing?.updatedAt,
                staleSinceEpochMs = staleSince,
                error = if (allFailed && members.isEmpty()) {
                    (familyResult as? DataResult.Failure)?.error?.message
                } else {
                    null
                },
            )
        }
    }

    private suspend fun loadFamilyAndRequests() {
        val members = repository.family(origin).dataOrNull ?: return
        val requests = repository.requests().dataOrNull.orEmpty()
        _state.update {
            it.copy(members = members, requests = requests, counts = FamilyMembers.counts(members))
        }
    }

    // --- circle mutations ---

    fun addMember(name: String, phone: String, relation: String) {
        val cleanName = name.trim()
        val digits = phone.count { it.isDigit() }
        if (cleanName.isEmpty() || digits < 6) {
            _state.update { it.copy(message = "Enter a name and a valid phone number.") }
            return
        }
        if (_state.value.addBusy) return
        _state.update { it.copy(addBusy = true) }
        viewModelScope.launch {
            try {
                val member = repository.addMember(cleanName, phone.trim(), relation.trim().ifBlank { null })
                loadFamilyAndRequests()
                _state.update {
                    it.copy(
                        addBusy = false,
                        message = if (member.linkStatus == "pending") {
                            "Request sent to ${member.name}."
                        } else {
                            "${member.name} added as a saved contact."
                        },
                    )
                }
            } catch (e: ApiError) {
                _state.update { it.copy(addBusy = false, message = e.message) }
            } catch (_: Exception) {
                _state.update { it.copy(addBusy = false, message = "Couldn't add that person. Try again.") }
            }
        }
    }

    fun removeMember(member: FamilyMemberDto) {
        viewModelScope.launch {
            runCatching { repository.removeMember(member.id) }
                .onSuccess {
                    loadFamilyAndRequests()
                    _state.update { it.copy(message = "${member.name} removed from your circle.") }
                }
                .onFailure { _state.update { it.copy(message = "Couldn't remove that person. Try again.") } }
        }
    }

    fun respond(request: FamilyRequestDto, accept: Boolean) {
        viewModelScope.launch {
            runCatching { repository.respond(request.id, accept) }
                .onSuccess {
                    loadFamilyAndRequests()
                    _state.update {
                        it.copy(message = if (accept) "You're now in their circle." else "Request declined.")
                    }
                }
                .onFailure { _state.update { it.copy(message = "Couldn't respond. Try again.") } }
        }
    }

    // --- location sharing ---

    fun toggleSharing() {
        if (_state.value.sharingBusy) return
        val next = !_state.value.sharingEnabled

        if (next && !locationProvider.hasPermission()) {
            _state.update { it.copy(message = "Grant location permission to share your location.") }
            return
        }

        _state.update { it.copy(sharingBusy = true) }
        viewModelScope.launch {
            try {
                val result = repository.setSharing(next)
                _state.update {
                    it.copy(
                        sharingBusy = false,
                        sharingEnabled = result.enabled,
                        sharingUpdatedAt = result.updatedAt,
                        message = if (result.enabled) {
                            "Location sharing on. Your circle sees your last point."
                        } else {
                            "Location sharing off. Your last point was cleared."
                        },
                    )
                }
                if (result.enabled) {
                    LocationSharingService.start(context)
                } else {
                    LocationSharingService.stop(context)
                }
            } catch (e: ApiError) {
                _state.update { it.copy(sharingBusy = false, message = e.message) }
            } catch (_: Exception) {
                _state.update { it.copy(sharingBusy = false, message = "Couldn't change location sharing.") }
            }
        }
    }

    fun consumeMessage() = _state.update { it.copy(message = null) }

    override fun onCleared() {
        pollJob?.cancel()
    }

    private companion object {
        // Slow backstop only — SSE (family.updated) is the fast path now.
        const val POLL_INTERVAL_MS = 120_000L
    }
}
