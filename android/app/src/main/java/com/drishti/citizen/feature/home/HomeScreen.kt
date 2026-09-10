package com.drishti.citizen.feature.home

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.drishti.citizen.core.location.LocationUiState
import com.drishti.citizen.core.ui.component.Sparkline
import com.drishti.citizen.core.ui.theme.Danger100
import com.drishti.citizen.core.ui.theme.Danger500
import com.drishti.citizen.core.ui.theme.Danger600
import com.drishti.citizen.core.ui.theme.Navy800
import com.drishti.citizen.core.ui.theme.Navy900
import com.drishti.citizen.core.ui.theme.Safe100
import com.drishti.citizen.core.ui.theme.Safe500
import com.drishti.citizen.core.ui.theme.Safe600
import com.drishti.citizen.core.ui.theme.Slate100
import com.drishti.citizen.core.ui.theme.Slate500
import com.drishti.citizen.core.ui.theme.Warn100
import com.drishti.citizen.core.ui.theme.Warn500
import com.drishti.citizen.core.ui.theme.Warn600
import com.drishti.citizen.data.model.Alerts
import com.drishti.citizen.data.model.RiskCard
import com.drishti.citizen.data.model.RiskLevel
import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.data.remote.dto.FloodForecastDto
import com.drishti.citizen.data.remote.dto.NearbyPlaceDto
import com.drishti.citizen.data.remote.dto.NearbyShelterDto
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onOpenSupport: () -> Unit = {},
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { viewModel.onLocationPermissionResult() }

    fun requestLocation() = permissionLauncher.launch(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
    )

    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = viewModel::refresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        if (state.loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            return@PullToRefreshBox
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Hero(firstName = state.firstName, stale = state.staleSinceEpochMs != null)

            when (state.location) {
                LocationUiState.PermissionNeeded -> LocationRationaleCard(onGrant = ::requestLocation)
                LocationUiState.Unavailable -> InfoCard(
                    "Couldn't get your location — showing area-wide information only.",
                )
                else -> Unit
            }

            state.topAlert?.let { AlertBanner(it, onClick = onOpenSupport) }

            if (state.loadError != null && state.riskCards.all { !it.live }) {
                ErrorCard(message = state.loadError!!, onRetry = viewModel::refresh)
            }

            SectionHeader("Risk & Environmental Overview")
            RiskCardGrid(state.riskCards)

            SectionHeader("Nearby Shelters")
            NearbyShelters(
                shelters = state.nearbyShelters,
                osm = state.osmShelters,
                locating = state.location is LocationUiState.Locating,
            )

            val river = state.river
            if (river != null && river.anomalyRatio != null) {
                SectionHeader("River Discharge", trailing = "GloFAS forecast")
                RiverDischargeCard(river)
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun Hero(firstName: String?, stale: Boolean) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Navy800, Navy900)))
            .padding(24.dp),
    ) {
        Column {
            Text(
                "STAY INFORMED · STAY PREPARED · STAY SAFE",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.6f),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Welcome back, ${firstName ?: "there"}!",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                if (stale) {
                    "You're offline — showing the last saved update."
                } else {
                    "Here's what's happening in and around your area."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.72f),
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String, trailing: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        if (trailing != null) {
            Spacer(Modifier.size(8.dp))
            Text(trailing.uppercase(), style = MaterialTheme.typography.labelSmall, color = Slate500)
        }
    }
}

@Composable
private fun RiskCardGrid(cards: List<RiskCard>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        cards.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { card ->
                    RiskCardView(card, Modifier.weight(1f))
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

private data class LevelPalette(val accent: Color, val bg: Color, val spark: Color)

private fun palette(level: RiskLevel): LevelPalette = when (level) {
    RiskLevel.LOW -> LevelPalette(Safe600, Safe100, Safe500)
    RiskLevel.MODERATE -> LevelPalette(Warn600, Warn100, Warn500)
    RiskLevel.HIGH -> LevelPalette(Danger500, Danger100, Danger500)
    RiskLevel.CRITICAL -> LevelPalette(Danger600, Danger100, Danger600)
}

private fun RiskLevel.label() = when (this) {
    RiskLevel.LOW -> "Low"
    RiskLevel.MODERATE -> "Moderate"
    RiskLevel.HIGH -> "High"
    RiskLevel.CRITICAL -> "Critical"
}

@Composable
private fun RiskCardView(card: RiskCard, modifier: Modifier = Modifier) {
    val pal = palette(card.level)
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Badge(text = card.level.label(), accent = pal.accent, bg = pal.bg)
                if (card.live) {
                    Text(
                        "LIVE",
                        style = MaterialTheme.typography.labelSmall,
                        color = Safe600,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(card.title, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    card.headline,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.size(6.dp))
                Text(
                    card.subtext,
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate500,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            Spacer(Modifier.height(10.dp))
            Sparkline(
                data = card.trend,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(40.dp),
                color = pal.spark,
                fill = true,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "“${card.recommendation}”",
                style = MaterialTheme.typography.bodySmall,
                fontStyle = FontStyle.Italic,
                color = Slate500,
            )
        }
    }
}

@Composable
private fun Badge(text: String, accent: Color, bg: Color) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(accent))
        Text(text, style = MaterialTheme.typography.labelSmall, color = accent, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun AlertBanner(alert: AlertDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Danger100),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Badge(
                    text = Alerts.severityLabel(alert.severity).uppercase(),
                    accent = Color.White,
                    bg = Danger600,
                )
                Text(
                    "${Alerts.sourceLabel(alert.source)} · ${Alerts.relativeTime(alert.issuedAt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Danger600,
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                alert.message,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = Danger600,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                "Tap to see all authority messages",
                style = MaterialTheme.typography.bodySmall,
                color = Danger600.copy(alpha = 0.8f),
            )
        }
    }
}

@Composable
private fun NearbyShelters(
    shelters: List<NearbyShelterDto>,
    osm: List<NearbyPlaceDto>,
    locating: Boolean,
) {
    if (shelters.isEmpty() && osm.isEmpty()) {
        InfoCard(if (locating) "Finding shelters near you…" else "No shelters found near your location.")
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        shelters.forEach { s ->
            InfoRowCard(
                title = s.name,
                trailing = "${format1(s.distanceKm)} km",
                subtitle = "${s.occupied}/${s.capacity} occupied · ${s.accessibility ?: "accessibility unknown"} · ${s.status}",
            )
        }
        if (osm.isNotEmpty()) {
            Text(
                "OTHER NEARBY SHELTERS · OPENSTREETMAP",
                style = MaterialTheme.typography.labelSmall,
                color = Slate500,
            )
            val context = LocalContext.current
            osm.forEach { p ->
                InfoRowCard(
                    title = p.name,
                    trailing = "${format1(p.distanceKm)} km",
                    subtitle = p.address ?: "Tap to open in maps",
                    onClick = {
                        val uri = Uri.parse(
                            "https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}" +
                                "#map=17/${p.latitude}/${p.longitude}",
                        )
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    },
                )
            }
        }
    }
}

@Composable
private fun RiverDischargeCard(flood: FloodForecastDto) {
    val pal = palette(
        when (flood.level.lowercase()) {
            "low" -> RiskLevel.LOW
            "high" -> RiskLevel.HIGH
            "critical" -> RiskLevel.CRITICAL
            else -> RiskLevel.MODERATE
        },
    )
    val label = when (flood.level.lowercase()) {
        "low" -> "Near normal"
        "moderate" -> "Above normal"
        "high" -> "High flow"
        else -> "Very high flow"
    }
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Nearest river reach", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text("Copernicus GloFAS discharge model", style = MaterialTheme.typography.bodySmall, color = Slate500)
                }
                Badge(text = label, accent = pal.accent, bg = pal.bg)
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    thousands(flood.currentDischargeM3s),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.size(4.dp))
                Text("m³/s current flow", style = MaterialTheme.typography.bodySmall, color = Slate500, modifier = Modifier.padding(bottom = 4.dp))
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Normal ${thousands(flood.baselineDischargeM3s)} m³/s · forecast peak " +
                    "${thousands(flood.forecastPeakM3s)} m³/s" +
                    (flood.anomalyRatio?.let { " (${format1(it)}× normal)" } ?: ""),
                style = MaterialTheme.typography.bodySmall,
                color = Danger600,
            )
            Spacer(Modifier.height(12.dp))
            Sparkline(
                data = flood.trend.map { it.toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                color = pal.spark,
                fill = true,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "“${flood.recommendation}”",
                style = MaterialTheme.typography.bodySmall,
                fontStyle = FontStyle.Italic,
                color = Slate500,
            )
        }
    }
}

@Composable
private fun LocationRationaleCard(onGrant: () -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Share your location", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(
                "Aasha Setu uses a single location fix to show the flood risk for your area, " +
                    "nearby shelters, and local weather forecasts. It is never shared or tracked in the background.",
                style = MaterialTheme.typography.bodySmall,
                color = Slate500,
            )
            Spacer(Modifier.height(12.dp))
            Button(onClick = onGrant) { Text("Allow location access") }
        }
    }
}

@Composable
private fun InfoCard(text: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
        Text(
            text,
            modifier = Modifier.padding(16.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = Slate500,
        )
    }
}

@Composable
private fun ErrorCard(message: String, onRetry: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Danger100)) {
        Column(Modifier.padding(16.dp)) {
            Text(message, style = MaterialTheme.typography.bodyMedium, color = Danger600)
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onRetry) { Text("Retry") }
        }
    }
}

@Composable
private fun InfoRowCard(
    title: String,
    trailing: String,
    subtitle: String,
    onClick: (() -> Unit)? = null,
) {
    val base = Modifier.fillMaxWidth()
    Card(
        modifier = if (onClick != null) base.clickable(onClick = onClick) else base,
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                Text(trailing, style = MaterialTheme.typography.bodySmall, color = Slate500, fontFamily = FontFamily.Monospace)
            }
            Spacer(Modifier.height(4.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Slate500)
        }
    }
}

private fun format1(v: Double): String = ((v * 10).roundToInt() / 10.0).toString()

private fun thousands(v: Double): String = "%,d".format(v.roundToInt())
