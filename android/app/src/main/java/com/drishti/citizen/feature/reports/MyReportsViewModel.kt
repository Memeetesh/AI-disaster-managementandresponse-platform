package com.drishti.citizen.feature.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.core.network.MediaUrls
import com.drishti.citizen.core.realtime.RealtimeBus
import com.drishti.citizen.core.realtime.RealtimeEvent
import com.drishti.citizen.core.ui.component.BadgeTone
import com.drishti.citizen.data.model.Alerts
import com.drishti.citizen.data.model.Incidents
import com.drishti.citizen.data.remote.dto.IncidentDto
import com.drishti.citizen.data.repository.IncidentsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReportRow(
    val id: Int,
    val typeLabel: String,
    val whenText: String,
    val peopleAffected: Int,
    val severityLabel: String,
    val severityTone: BadgeTone,
    val statusLabel: String,
    val statusTone: BadgeTone,
    val description: String?,
    val thumbnailUrls: List<String>,
)

data class MyReportsUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val reports: List<ReportRow> = emptyList(),
    val staleSinceEpochMs: Long? = null,
    val error: String? = null,
)

@HiltViewModel
class MyReportsViewModel @Inject constructor(
    private val incidentsRepository: IncidentsRepository,
    private val mediaUrls: MediaUrls,
    realtimeBus: RealtimeBus,
) : ViewModel() {

    private val _state = MutableStateFlow(MyReportsUiState())
    val state: StateFlow<MyReportsUiState> = _state.asStateFlow()

    init {
        load(isRefresh = false)
        viewModelScope.launch {
            realtimeBus.events.collect { event ->
                if (event is RealtimeEvent.IncidentChanged || event == RealtimeEvent.Reconnected) {
                    load(isRefresh = true)
                }
            }
        }
    }

    fun refresh() = load(isRefresh = true)

    private fun load(isRefresh: Boolean) {
        _state.update {
            it.copy(loading = !isRefresh && it.reports.isEmpty(), refreshing = isRefresh, error = null)
        }
        viewModelScope.launch {
            when (val result = incidentsRepository.myReports()) {
                is DataResult.Fresh -> _state.value =
                    MyReportsUiState(loading = false, reports = result.data.map(::toRow))

                is DataResult.Stale -> _state.value = MyReportsUiState(
                    loading = false,
                    reports = result.data.map(::toRow),
                    staleSinceEpochMs = result.cachedAtEpochMs,
                )

                is DataResult.Failure -> _state.update {
                    it.copy(loading = false, refreshing = false, error = result.error.message)
                }
            }
        }
    }

    private fun toRow(incident: IncidentDto): ReportRow = ReportRow(
        id = incident.id,
        typeLabel = Incidents.typeLabel(incident.type),
        whenText = Alerts.relativeTime(incident.createdAt),
        peopleAffected = incident.peopleAffected,
        severityLabel = Incidents.severityLabel(incident.severity),
        severityTone = Incidents.severityTone(incident.severity),
        statusLabel = Incidents.statusLabel(incident.status),
        statusTone = Incidents.statusTone(incident.status),
        description = incident.description,
        thumbnailUrls = incident.imageEvidenceUrls.mapNotNull(mediaUrls::resolve),
    )
}
