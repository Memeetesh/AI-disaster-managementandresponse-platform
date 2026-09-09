package com.drishti.citizen.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.auth.AuthState
import com.drishti.citizen.core.auth.SessionManager
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.location.LocationProvider
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.data.model.Alerts
import com.drishti.citizen.data.model.RiskCard
import com.drishti.citizen.data.model.RiskCards
import com.drishti.citizen.data.model.zoneAt
import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.NearbyPlaceDto
import com.drishti.citizen.data.remote.dto.NearbyShelterDto
import com.drishti.citizen.data.remote.dto.RiskZonePropertiesDto
import com.drishti.citizen.data.repository.AlertsRepository
import com.drishti.citizen.data.repository.PlacesRepository
import com.drishti.citizen.data.repository.RiskRepository
import com.drishti.citizen.data.repository.SheltersRepository
import com.drishti.citizen.data.repository.WeatherRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface LocationUiState {
    data object PermissionNeeded : LocationUiState
    data object Locating : LocationUiState
    data class Ready(val at: LatLon) : LocationUiState

    /** Permission granted, but no fix and nothing cached. */
    data object Unavailable : LocationUiState
}

data class HomeUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val firstName: String? = null,
    val location: LocationUiState = LocationUiState.Locating,
    val topAlert: AlertDto? = null,
    val riskCards: List<RiskCard> = emptyList(),
    val currentZone: RiskZonePropertiesDto? = null,
    val nearbyShelters: List<NearbyShelterDto> = emptyList(),
    val osmShelters: List<NearbyPlaceDto> = emptyList(),
    val river: FloodForecastDto? = null,
    /** Oldest cache timestamp among any snapshot that was served stale, else null. */
    val staleSinceEpochMs: Long? = null,
    /** Set only when every request failed with nothing cached. */
    val loadError: String? = null,
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val locationProvider: LocationProvider,
    private val riskRepository: RiskRepository,
    private val alertsRepository: AlertsRepository,
    private val weatherRepository: WeatherRepository,
    private val sheltersRepository: SheltersRepository,
    private val placesRepository: PlacesRepository,
    sessionManager: SessionManager,
) : ViewModel() {

    private val firstName: String? =
        (sessionManager.state.value as? AuthState.SignedIn)?.user?.name
            ?.trim()?.substringBefore(' ')?.takeIf { it.isNotBlank() }

    private val _state = MutableStateFlow(HomeUiState(firstName = firstName))
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init {
        load(isRefresh = false)
    }

    fun refresh() = load(isRefresh = true)

    /** Call after the runtime location-permission dialog is answered. */
    fun onLocationPermissionResult() = load(isRefresh = true)

    private fun load(isRefresh: Boolean) {
        _state.update {
            it.copy(loading = !isRefresh && it.riskCards.isEmpty(), refreshing = isRefresh)
        }
        viewModelScope.launch {
            val fix = resolveLocation()
            _state.value = assemble(fix)
        }
    }

    private suspend fun resolveLocation(): LatLon? {
        if (!locationProvider.hasPermission()) {
            _state.update { it.copy(location = LocationUiState.PermissionNeeded) }
            return null
        }
        _state.update { it.copy(location = LocationUiState.Locating) }
        return locationProvider.currentFix()
    }

    private suspend fun assemble(fix: LatLon?): HomeUiState = coroutineScope {
        val riskMapDeferred = async { riskRepository.riskMap() }
        val alertsDeferred = async { alertsRepository.alerts() }
        val rainfallDeferred = fix?.let { at -> async { weatherRepository.rainfall(at) } }
        val floodDeferred = fix?.let { at -> async { weatherRepository.flood(at) } }
        val cycloneDeferred = fix?.let { at -> async { weatherRepository.cyclone(at) } }
        val landslideDeferred = fix?.let { at -> async { weatherRepository.landslide(at) } }
        val sheltersDeferred = fix?.let { at -> async { sheltersRepository.nearest(at, limit = 3) } }

        val riskMapResult = riskMapDeferred.await()
        val alertsResult = alertsDeferred.await()
        val rainfallResult = rainfallDeferred?.await()
        val floodResult = floodDeferred?.await()
        val cycloneResult = cycloneDeferred?.await()
        val landslideResult = landslideDeferred?.await()
        val sheltersResult = sheltersDeferred?.await()

        val riskMap = riskMapResult.dataOrNull
        val currentZone = if (fix != null && riskMap != null) riskMap.zoneAt(fix.lat, fix.lon) else null

        val allShelters = sheltersResult?.dataOrNull.orEmpty()
        val nearShelters = allShelters.filter { it.distanceKm <= 25.0 }

        // Only hit OpenStreetMap when there aren't enough registered shelters (web parity).
        val osmResult =
            if (fix != null && nearShelters.size < 3) placesRepository.nearbyShelters(fix) else null

        val flood = floodResult?.dataOrNull

        val results = listOfNotNull(
            riskMapResult, alertsResult, rainfallResult, floodResult,
            cycloneResult, landslideResult, sheltersResult, osmResult,
        )
        val staleSince = results
            .filterIsInstance<DataResult.Stale<*>>()
            .minOfOrNull { it.cachedAtEpochMs }
        val everythingFailed = results.isNotEmpty() && results.all { it is DataResult.Failure }

        HomeUiState(
            loading = false,
            refreshing = false,
            firstName = firstName,
            location = when {
                fix != null -> LocationUiState.Ready(fix)
                !locationProvider.hasPermission() -> LocationUiState.PermissionNeeded
                else -> LocationUiState.Unavailable
            },
            topAlert = Alerts.topAlert(alertsResult.dataOrNull.orEmpty()),
            riskCards = RiskCards.build(
                currentZone = currentZone,
                rainfall = rainfallResult?.dataOrNull,
                flood = flood,
                cyclone = cycloneResult?.dataOrNull,
                landslide = landslideResult?.dataOrNull,
            ),
            currentZone = currentZone,
            nearbyShelters = nearShelters,
            osmShelters = osmResult?.dataOrNull.orEmpty(),
            river = flood,
            staleSinceEpochMs = staleSince,
            loadError = if (everythingFailed) {
                (results.first() as DataResult.Failure).error.message
            } else {
                null
            },
        )
    }
}
