package com.drishti.citizen.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.drishti.citizen.core.ui.component.HeroBanner
import com.drishti.citizen.core.ui.component.Sparkline
import com.drishti.citizen.core.ui.theme.DrishtiTheme
import com.drishti.citizen.core.ui.theme.Slate500
import com.drishti.citizen.core.ui.theme.Warn500

@Composable
fun HomeScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        HeroBanner(
            title = "Stay informed. Stay safe.",
            subtitle = "Here's what's happening in and around your area.",
        )

        // A live-data card lands in Phase 2 — this just proves the theme and the
        // trend sparkline render.
        ElevatedCard {
            Column(Modifier.padding(16.dp)) {
                Text("Rainfall — next 7 days", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(12.dp))
                Sparkline(
                    data = listOf(4f, 8f, 6f, 12f, 18f, 14f, 22f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    color = Warn500,
                    fill = true,
                )
            }
        }

        Text(
            "Risk cards, alerts, nearby shelters and river discharge arrive in Phase 2.",
            style = MaterialTheme.typography.bodyMedium,
            color = Slate500,
        )
    }
}

@Preview
@Composable
private fun HomeScreenPreview() {
    DrishtiTheme { HomeScreen() }
}
