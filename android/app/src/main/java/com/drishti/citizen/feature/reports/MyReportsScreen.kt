package com.drishti.citizen.feature.reports

import androidx.compose.runtime.Composable
import com.drishti.citizen.core.ui.component.PlaceholderScreen

@Composable
fun MyReportsScreen() {
    PlaceholderScreen(
        title = "My Reports",
        subtitle = "Everything you've reported through SOS or the incident form.",
        note = "The list and live status updates arrive in Phase 3 (GET /incidents).",
    )
}
