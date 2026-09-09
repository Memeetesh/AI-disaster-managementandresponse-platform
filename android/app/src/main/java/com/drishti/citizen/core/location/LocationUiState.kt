package com.drishti.citizen.core.location

/** Shared location state for screens that need a fix (Home, Report). */
sealed interface LocationUiState {
    data object PermissionNeeded : LocationUiState
    data object Locating : LocationUiState
    data class Ready(val at: LatLon) : LocationUiState

    /** Permission granted, but no fix and nothing cached. */
    data object Unavailable : LocationUiState
}
