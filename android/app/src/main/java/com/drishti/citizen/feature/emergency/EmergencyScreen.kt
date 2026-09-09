package com.drishti.citizen.feature.emergency

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.LocalHospital
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.location.LocationUiState
import com.drishti.citizen.core.util.dialNumber
import com.drishti.citizen.core.util.openLocationOnMap
import com.drishti.citizen.core.ui.theme.Danger100
import com.drishti.citizen.core.ui.theme.Danger600
import com.drishti.citizen.core.ui.theme.Danger700
import com.drishti.citizen.core.ui.theme.Navy700
import com.drishti.citizen.core.ui.theme.Safe100
import com.drishti.citizen.core.ui.theme.Safe600
import com.drishti.citizen.core.ui.theme.Slate500
import com.drishti.citizen.core.ui.theme.Warn600

@Composable
fun EmergencyScreen(viewModel: EmergencyViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { viewModel.onLocationPermissionResult() }

    val notificationsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* best-effort; the queued-SOS notification is optional */ }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationsLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    SosResultDialog(state.sos, onDismiss = viewModel::dismissSosResult)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Hero(state.location)

        if (state.location is LocationUiState.PermissionNeeded) {
            OutlinedButton(onClick = {
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                )
            }) { Text("Share location for emergency help") }
        }

        SosButton(
            stage = state.sos,
            enabled = state.location is LocationUiState.Ready,
            onStartHold = viewModel::startHold,
            onCancelHold = viewModel::cancelHold,
        )

        QuickActions(
            state = state,
            onDial = { number -> dialNumber(context, number) },
            onOpenMap = { at, label -> openLocationOnMap(context, at.lat, at.lon, label) },
        )

        SafeButton(
            isSafe = state.checkIn?.isSafe == true,
            submitting = state.checkInSubmitting,
            message = state.checkInMessage,
            onClick = viewModel::markSafe,
        )
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Hero(location: LocationUiState) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Danger600, Danger700)))
            .padding(20.dp),
    ) {
        Column {
            Text("Emergency Assistance", style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Bold)
            Text("Immediate help is available. Stay calm.", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.85f))
            Spacer(Modifier.height(12.dp))
            val text = when (location) {
                is LocationUiState.Ready -> "%.4f, %.4f".format(location.at.lat, location.at.lon)
                LocationUiState.Locating -> "Getting your location…"
                LocationUiState.PermissionNeeded -> "Location permission needed"
                LocationUiState.Unavailable -> "Location unavailable"
            }
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = 0.15f))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text, style = MaterialTheme.typography.bodySmall, color = Color.White, fontFamily = FontFamily.Monospace)
            }
        }
    }
}

@Composable
private fun SosButton(
    stage: SosStage,
    enabled: Boolean,
    onStartHold: () -> Unit,
    onCancelHold: () -> Unit,
) {
    val progress = (stage as? SosStage.Holding)?.progress ?: 0f
    val busy = stage is SosStage.Submitting

    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .clip(CircleShape)
                    .background(if (enabled) Danger600 else Danger600.copy(alpha = 0.4f))
                    .pointerInput(enabled) {
                        if (!enabled) return@pointerInput
                        detectTapGestures(
                            onPress = {
                                onStartHold()
                                tryAwaitRelease()
                                onCancelHold()
                            },
                        )
                    },
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (busy) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 3.dp)
                    } else {
                        Text("SOS", style = MaterialTheme.typography.displaySmall, color = Color.White, fontWeight = FontWeight.Bold)
                        Text("Hold for 3s", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.85f))
                    }
                }
            }
            if (progress > 0f) {
                Canvas(Modifier.size(212.dp)) {
                    drawArc(
                        color = Color.White,
                        startAngle = -90f,
                        sweepAngle = 360f * progress,
                        useCenter = false,
                        topLeft = androidx.compose.ui.geometry.Offset(0f, 0f),
                        size = Size(size.width, size.height),
                        style = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round),
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            if (enabled) "Press and hold to send your location to responders" else "Waiting for your location…",
            style = MaterialTheme.typography.bodySmall,
            color = Slate500,
        )
    }
}

@Composable
private fun QuickActions(
    state: EmergencyUiState,
    onDial: (String) -> Unit,
    onOpenMap: (LatLon, String) -> Unit,
) {
    val hospital = state.nearestHospital
    val rescue = state.nearestRescue
    val self = (state.location as? LocationUiState.Ready)?.at

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ActionCard(
            icon = Icons.Rounded.Call,
            label = "Helpline (112)",
            detail = "Tap to call emergency services",
            tint = Navy700,
            onClick = { onDial("112") },
        )
        ActionCard(
            icon = Icons.Rounded.LocalHospital,
            label = "Nearest hospital",
            detail = when {
                hospital != null -> "${hospital.name} · ${format1(hospital.distanceKm)} km"
                state.placesLoading -> "Finding nearest hospital…"
                else -> "None found nearby"
            },
            tint = Safe600,
            enabled = hospital != null,
            onClick = {
                if (hospital?.phone != null) {
                    onDial(hospital.phone.filter { it.isDigit() || it == '+' })
                } else if (hospital != null) {
                    onOpenMap(LatLon(hospital.latitude, hospital.longitude), hospital.name)
                }
            },
        )
        ActionCard(
            icon = Icons.Rounded.Shield,
            label = "Nearest rescue centre",
            detail = rescue?.let { "${it.name} · ${format1(it.distanceKm)} km" }
                ?: "No registered shelter nearby",
            tint = Danger600,
            enabled = rescue != null,
            onClick = { rescue?.let { onOpenMap(LatLon(it.latitude, it.longitude), it.name) } },
        )
        ActionCard(
            icon = Icons.Rounded.Map,
            label = "Open area map",
            detail = "Show shelters and hospitals around you",
            tint = Warn600,
            enabled = self != null,
            onClick = { self?.let { onOpenMap(it, "My location") } },
        )
    }
}

@Composable
private fun ActionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    detail: String,
    tint: Color,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(icon, contentDescription = null, tint = if (enabled) tint else Slate500)
            Column(Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                Text(detail, style = MaterialTheme.typography.bodySmall, color = Slate500)
            }
        }
    }
}

@Composable
private fun SafeButton(
    isSafe: Boolean,
    submitting: Boolean,
    message: String?,
    onClick: () -> Unit,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        OutlinedButton(onClick = onClick, enabled = !submitting) {
            Icon(Icons.Rounded.Shield, contentDescription = null, tint = Safe600, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(
                when {
                    submitting -> "Sending…"
                    isSafe -> "You are marked as Safe"
                    else -> "I am Safe"
                },
            )
        }
        if (message != null) {
            Spacer(Modifier.height(6.dp))
            Text(message, style = MaterialTheme.typography.bodySmall, color = Slate500)
        }
    }
}

@Composable
private fun SosResultDialog(stage: SosStage, onDismiss: () -> Unit) {
    val (title, body) = when (stage) {
        is SosStage.Sent -> "SOS sent" to
            "Incident #${stage.incidentId} is with responders. Keep your phone on."
        SosStage.Queued -> "SOS queued" to
            "You're offline. It will send automatically as soon as you have a connection — " +
            "it has NOT reached responders yet."
        is SosStage.Failed -> "SOS not sent" to stage.message
        else -> return
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("OK") } },
        title = { Text(title) },
        text = { Text(body) },
        containerColor = if (stage is SosStage.Failed) Danger100 else Safe100,
    )
}

private fun format1(v: Double): String = "%.1f".format(v)
