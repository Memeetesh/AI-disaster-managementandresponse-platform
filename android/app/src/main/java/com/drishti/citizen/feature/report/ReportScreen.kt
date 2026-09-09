package com.drishti.citizen.feature.report

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.PhotoCamera
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.drishti.citizen.core.location.LocationUiState
import com.drishti.citizen.data.model.IncidentType
import com.drishti.citizen.data.model.Incidents
import com.drishti.citizen.core.ui.theme.Danger600
import com.drishti.citizen.core.ui.theme.Safe600
import com.drishti.citizen.core.ui.theme.Slate500

@Composable
fun ReportScreen(
    onDone: () -> Unit,
    onViewReports: () -> Unit,
    viewModel: ReportViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { viewModel.onLocationPermissionResult() }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> viewModel.setImage(uri) }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) viewModel.startRecording() }

    fun toggleRecording() {
        if (state.recording) {
            viewModel.stopRecording()
            return
        }
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        if (granted) viewModel.startRecording() else micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        val result = state.result
        if (result != null) {
            Confirmation(result, onViewReports = onViewReports, onDone = onDone)
            return@Column
        }

        Text("Report an Incident", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "For non-emergencies — e.g. a flooded road with no one in danger. Use Emergency SOS " +
                "if someone is in immediate danger.",
            style = MaterialTheme.typography.bodyMedium,
            color = Slate500,
        )

        LocationRow(
            location = state.location,
            onGrant = {
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                )
            },
        )

        FieldLabel("Incident type")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            IncidentType.entries.forEach { type ->
                FilterChip(
                    selected = state.type == type,
                    onClick = { viewModel.setType(type) },
                    label = { Text(type.label) },
                )
            }
        }

        FieldLabel("People affected (if any)")
        Stepper(value = state.peopleAffected, onChange = viewModel::setPeopleAffected)

        FieldLabel("Description")
        OutlinedTextField(
            value = state.description,
            onValueChange = viewModel::setDescription,
            placeholder = { Text("e.g. Main road near the market is flooded, cars are turning back.") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
        )

        FieldLabel("Photo (optional)")
        if (state.imageUri == null) {
            OutlinedButton(onClick = {
                photoPicker.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                )
            }) {
                Icon(Icons.Rounded.PhotoCamera, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Add a photo")
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AsyncImage(
                    model = state.imageUri,
                    contentDescription = "Selected photo",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(12.dp)),
                )
                TextButton(onClick = { viewModel.setImage(null) }) { Text("Remove") }
            }
        }

        FieldLabel("Voice note (optional)")
        when {
            state.recording -> Button(
                onClick = ::toggleRecording,
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Danger600),
            ) {
                Icon(Icons.Rounded.Stop, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Stop recording")
            }

            state.audioFile != null -> Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = Safe600, modifier = Modifier.size(18.dp))
                Text("Voice note attached", style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = viewModel::discardAudio) { Text("Remove") }
            }

            else -> OutlinedButton(onClick = ::toggleRecording) {
                Icon(Icons.Rounded.Mic, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Record a voice note")
            }
        }

        state.error?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = Danger600)
        }

        Button(
            onClick = viewModel::submit,
            enabled = state.canSubmit,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (state.submitting) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Text("Submit report")
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Confirmation(result: ReportResult, onViewReports: () -> Unit, onDone: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            Icons.Rounded.CheckCircle,
            contentDescription = null,
            tint = Safe600,
            modifier = Modifier.size(56.dp),
        )
        Text("Report submitted", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "Incident #${result.id} logged as ${Incidents.severityLabel(result.severity)} severity — " +
                "status “${Incidents.statusLabel(result.status)}”.",
            style = MaterialTheme.typography.bodyMedium,
            color = Slate500,
        )
        Text(
            if (result.settledByResponder) {
                "A responder has reviewed it."
            } else {
                "This updates live as a responder reviews it."
            },
            style = MaterialTheme.typography.bodySmall,
            color = Slate500,
        )
        Spacer(Modifier.height(8.dp))
        Button(onClick = onViewReports, modifier = Modifier.fillMaxWidth()) { Text("View my reports") }
        OutlinedButton(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text("Back to home") }
    }
}

@Composable
private fun LocationRow(location: LocationUiState, onGrant: () -> Unit) {
    when (location) {
        is LocationUiState.Ready -> Text(
            "${"%.5f".format(location.at.lat)}, ${"%.5f".format(location.at.lon)}",
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            color = Slate500,
        )

        LocationUiState.Locating -> Text("Locating…", style = MaterialTheme.typography.bodySmall, color = Slate500)

        LocationUiState.PermissionNeeded -> AssistChip(
            onClick = onGrant,
            label = { Text("Share location to report") },
        )

        LocationUiState.Unavailable -> Text(
            "Couldn't get your location — a report can't be sent without it.",
            style = MaterialTheme.typography.bodySmall,
            color = Danger600,
        )
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = Slate500)
}

@Composable
private fun Stepper(value: Int, onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { onChange(value - 1) }, enabled = value > 0) { Text("−") }
        Box(Modifier.size(width = 48.dp, height = 24.dp), contentAlignment = Alignment.Center) {
            Text("$value", style = MaterialTheme.typography.titleMedium)
        }
        OutlinedButton(onClick = { onChange(value + 1) }) { Text("+") }
    }
}
