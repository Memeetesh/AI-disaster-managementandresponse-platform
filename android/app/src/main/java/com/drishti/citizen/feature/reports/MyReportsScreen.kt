package com.drishti.citizen.feature.reports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.drishti.citizen.core.ui.component.StatusBadge
import com.drishti.citizen.core.ui.theme.Danger600
import com.drishti.citizen.core.ui.theme.Slate500

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyReportsScreen(
    onReportIncident: () -> Unit,
    viewModel: MyReportsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = viewModel::refresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }

            state.error != null && state.reports.isEmpty() -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    "Couldn't load your reports. Check your connection and pull to refresh.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Danger600,
                )
            }

            state.reports.isEmpty() -> EmptyState(onReportIncident)

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Button(onClick = onReportIncident, modifier = Modifier.fillMaxWidth()) {
                        Text("Report an incident")
                    }
                }
                if (state.staleSinceEpochMs != null) {
                    item {
                        Text(
                            "You're offline — showing your last saved reports.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate500,
                        )
                    }
                }
                items(state.reports, key = { it.id }) { row -> ReportCard(row) }
            }
        }
    }
}

@Composable
private fun ReportCard(row: ReportRow) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "#${row.id} · ${row.typeLabel}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${row.whenText} · ${row.peopleAffected} affected",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                    )
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    StatusBadge(row.severityLabel, row.severityTone)
                    StatusBadge(row.statusLabel, row.statusTone)
                }
            }
            if (!row.description.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(row.description, style = MaterialTheme.typography.bodyMedium)
            }
            if (row.thumbnailUrls.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.thumbnailUrls.take(4).forEach { url ->
                        AsyncImage(
                            model = url,
                            contentDescription = "Evidence photo for report ${row.id}",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(10.dp)),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyState(onReportIncident: () -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("No reports yet", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(
            "Anything you report through the incident form or Emergency SOS shows up here, with live status.",
            style = MaterialTheme.typography.bodyMedium,
            color = Slate500,
        )
        Spacer(Modifier.height(16.dp))
        OutlinedButton(onClick = onReportIncident) { Text("Report an incident") }
    }
}
