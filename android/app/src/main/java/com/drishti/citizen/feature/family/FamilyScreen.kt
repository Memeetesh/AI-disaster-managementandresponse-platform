package com.drishti.citizen.feature.family

import android.Manifest
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.drishti.citizen.core.ui.component.StatusBadge
import com.drishti.citizen.core.util.dialNumber
import com.drishti.citizen.core.util.openLocationOnMap
import com.drishti.citizen.core.ui.theme.Navy600
import com.drishti.citizen.core.ui.theme.Navy800
import com.drishti.citizen.core.ui.theme.Navy900
import com.drishti.citizen.core.ui.theme.Safe600
import com.drishti.citizen.core.ui.theme.Slate100
import com.drishti.citizen.core.ui.theme.Slate500
import com.drishti.citizen.data.model.Alerts
import com.drishti.citizen.data.model.FamilyMembers
import com.drishti.citizen.data.remote.dto.FamilyMemberDto
import com.drishti.citizen.data.remote.dto.FamilyRequestDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilyScreen(viewModel: FamilyViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { viewModel.onLocationPermissionResult() }

    fun requestLocation() = locationPermissionLauncher.launch(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
    )

    var showAddForm by remember { mutableStateOf(false) }

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

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item { Hero(state) }

            state.message?.let { message ->
                item {
                    MessageBanner(message, onDismiss = viewModel::consumeMessage)
                }
            }

            item {
                SharingCard(
                    enabled = state.sharingEnabled,
                    busy = state.sharingBusy,
                    updatedAt = state.sharingUpdatedAt,
                    locationGranted = state.locationGranted,
                    onToggle = viewModel::toggleSharing,
                    onGrantLocation = ::requestLocation,
                )
            }

            if (state.requests.isNotEmpty()) {
                item { SectionTitle("Requests") }
                items(state.requests, key = { "req-${it.id}" }) { request ->
                    RequestCard(
                        request = request,
                        onAccept = { viewModel.respond(request, accept = true) },
                        onDecline = { viewModel.respond(request, accept = false) },
                    )
                }
            }

            item {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SectionTitle("Your circle")
                    TextButton(onClick = { showAddForm = !showAddForm }) {
                        Text(if (showAddForm) "Cancel" else "Add member")
                    }
                }
            }

            if (showAddForm) {
                item {
                    AddMemberForm(
                        busy = state.addBusy,
                        onSubmit = { name, phone, relation ->
                            viewModel.addMember(name, phone, relation)
                            showAddForm = false
                        },
                    )
                }
            }

            if (state.staleSinceEpochMs != null) {
                item {
                    Text(
                        "You're offline — showing your last saved circle.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                    )
                }
            }

            when {
                state.error != null && state.members.isEmpty() -> item {
                    Text(
                        "Couldn't load your family circle. Pull to refresh.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }

                state.members.isEmpty() -> item {
                    EmptyCircle()
                }

                else -> items(state.members, key = { "mem-${it.id}" }) { member ->
                    MemberCard(
                        member = member,
                        onCall = { dialNumber(context, member.phone) },
                        onOpenLocation = {
                            if (member.latitude != null && member.longitude != null) {
                                openLocationOnMap(context, member.latitude, member.longitude, member.name)
                            }
                        },
                        onRemove = { viewModel.removeMember(member) },
                    )
                }
            }

            item { PrivacyNote() }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun Hero(state: FamilyUiState) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Navy800, Navy900)))
            .padding(20.dp),
    ) {
        Column {
            Text("Family Safety", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.6f))
            Spacer(Modifier.height(6.dp))
            Text(
                "Your family, connected & safe",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CountPill(state.counts.safe, "Safe")
                CountPill(state.counts.awaiting, "Awaiting")
                CountPill(state.counts.needHelp, "Need help")
            }
        }
    }
}

@Composable
private fun CountPill(value: Int, label: String) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.12f))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("$value", style = MaterialTheme.typography.titleMedium, color = Color.White, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.7f))
    }
}

@Composable
private fun SharingCard(
    enabled: Boolean,
    busy: Boolean,
    updatedAt: String?,
    locationGranted: Boolean,
    onToggle: () -> Unit,
    onGrantLocation: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Share my live location", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (enabled) {
                            "On — your circle sees your last point" +
                                (updatedAt?.let { ", updated ${Alerts.relativeTime(it)}" } ?: "") + "."
                        } else {
                            "Off by default. When on, a foreground service pings your point every ~2 min."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                    )
                }
                Switch(checked = enabled, onCheckedChange = { onToggle() }, enabled = !busy)
            }
            if (!locationGranted) {
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onGrantLocation) { Text("Grant location permission") }
            }
        }
    }
}

@Composable
private fun RequestCard(request: FamilyRequestDto, onAccept: () -> Unit, onDecline: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Text(
                "${request.ownerName} wants to follow your safety status",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                (request.relation?.let { "Added you as: $it · " } ?: "") + "They'll see your check-ins, not your location.",
                style = MaterialTheme.typography.bodySmall,
                color = Slate500,
            )
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onAccept) { Text("Accept") }
                OutlinedButton(onClick = onDecline) { Text("Decline") }
            }
        }
    }
}

@Composable
private fun AddMemberForm(busy: Boolean, onSubmit: (String, String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var relation by remember { mutableStateOf("") }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = relation, onValueChange = { relation = it }, label = { Text("Relation (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(
                onClick = { onSubmit(name, phone, relation) },
                enabled = !busy && name.isNotBlank() && phone.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (busy) "Adding…" else "Add to circle")
            }
        }
    }
}

@Composable
private fun MemberCard(
    member: FamilyMemberDto,
    onCall: () -> Unit,
    onOpenLocation: () -> Unit,
    onRemove: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Navy600),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(FamilyMembers.initials(member.name), color = Color.White, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(member.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        member.relation?.let {
                            Text(it, style = MaterialTheme.typography.labelSmall, color = Slate500)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    StatusBadge(member.statusLabel, FamilyMembers.statusTone(member.status))
                    Spacer(Modifier.height(4.dp))
                    Text(FamilyMembers.detailLine(member), style = MaterialTheme.typography.bodySmall, color = Slate500)
                    if (member.sharesLocation && member.latitude != null) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            buildString {
                                append(member.distanceKm?.let { "~${"%.1f".format(it)} km away" } ?: "Location shared")
                                member.locationUpdatedAt?.let { append(" · ${Alerts.relativeTime(it)}") }
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = Safe600,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable(onClick = onOpenLocation),
                        )
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = onCall) { Text("Call") }
                TextButton(onClick = onRemove) { Text("Remove", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}

@Composable
private fun EmptyCircle() {
    Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("No family members yet", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(
                "Add a loved one by phone to start following their safety status.",
                style = MaterialTheme.typography.bodySmall,
                color = Slate500,
            )
        }
    }
}

@Composable
private fun PrivacyNote() {
    Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
        Column(Modifier.padding(16.dp)) {
            Text("Privacy first", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(
                "A member must accept before you see anything. Status comes from their own check-ins " +
                    "and SOS activity. Location sharing is a separate opt-in each person controls and can " +
                    "turn off at any time — the point is then cleared.",
                style = MaterialTheme.typography.bodySmall,
                color = Slate500,
            )
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
}

@Composable
private fun MessageBanner(message: String, onDismiss: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(message, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
            TextButton(onClick = onDismiss) { Text("Dismiss") }
        }
    }
}
