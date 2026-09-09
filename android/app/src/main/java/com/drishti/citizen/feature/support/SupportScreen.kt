package com.drishti.citizen.feature.support

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.drishti.citizen.core.ui.component.BadgeTone
import com.drishti.citizen.core.ui.component.StatusBadge
import com.drishti.citizen.core.ui.theme.Navy700
import com.drishti.citizen.core.ui.theme.Slate100
import com.drishti.citizen.core.ui.theme.Slate500
import com.drishti.citizen.core.util.dialNumber
import com.drishti.citizen.data.model.Alerts
import com.drishti.citizen.data.model.SupportSamples
import com.drishti.citizen.data.model.SupportSamples.LostFoundType
import com.drishti.citizen.data.remote.dto.AlertDto

private enum class SupportTab(val label: String) {
    AUTHORITY("Authority"),
    LOST_FOUND("Lost & Found"),
    EMOTIONAL("Emotional"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(viewModel: SupportViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var tab by remember { mutableStateOf(SupportTab.AUTHORITY) }
    var showChat by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(16.dp)) {
            Text("Support & Recovery", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "Post-disaster help, communication, and emotional wellbeing.",
                style = MaterialTheme.typography.bodyMedium,
                color = Slate500,
            )
        }

        TabRow(selectedTabIndex = tab.ordinal) {
            SupportTab.entries.forEach { entry ->
                Tab(
                    selected = tab == entry,
                    onClick = { tab = entry },
                    text = { Text(entry.label, maxLines = 1) },
                )
            }
        }

        when (tab) {
            SupportTab.AUTHORITY -> AuthorityTab(state)
            SupportTab.LOST_FOUND -> LostFoundTab(onContact = { dialNumber(context, it) })
            SupportTab.EMOTIONAL -> EmotionalTab(
                onCallHelpline = { dialNumber(context, it) },
                onTalkToSaathi = { showChat = true },
            )
        }
    }

    if (showChat) {
        ModalBottomSheet(
            onDismissRequest = { showChat = false },
            sheetState = sheetState,
        ) {
            SaathiChat(
                turns = state.chat,
                sending = state.chatSending,
                onSend = viewModel::sendChat,
            )
        }
    }
}

/* ---------- Authority Messages ---------- */

@Composable
private fun AuthorityTab(state: SupportUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            NoteCard("Verified alerts from the command centre and disaster simulator. Updates live.")
        }
        if (state.alertsStaleSince != null) {
            item {
                Text(
                    "You're offline — showing the last saved alerts.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Slate500,
                )
            }
        }
        when {
            state.alertsLoading -> item {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }

            state.alertsError != null && state.alerts.isEmpty() -> item {
                Text(
                    state.alertsError.orEmpty(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            state.alerts.isEmpty() -> item {
                Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
                    Text(
                        "No active alerts right now.",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Slate500,
                    )
                }
            }

            else -> items(state.alerts, key = { it.id }) { alert -> AlertCard(alert) }
        }
    }
}

@Composable
private fun AlertCard(alert: AlertDto) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatusBadge(Alerts.sourceLabel(alert.source), BadgeTone.INFO)
                    StatusBadge(
                        Alerts.severityLabel(alert.severity).replaceFirstChar { it.uppercase() },
                        Alerts.severityTone(alert.severity),
                    )
                }
                Text(Alerts.relativeTime(alert.issuedAt), style = MaterialTheme.typography.labelSmall, color = Slate500)
            }
            Spacer(Modifier.height(8.dp))
            Text(
                alert.type.replace('_', ' ').replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(2.dp))
            Text(alert.message, style = MaterialTheme.typography.bodyMedium, color = Slate500)
        }
    }
}

/* ---------- Lost & Found (sample) ---------- */

@Composable
private fun LostFoundTab(onContact: (String) -> Unit) {
    var filter by remember { mutableStateOf<LostFoundType?>(null) }
    val items = SupportSamples.lostFound(filter)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { NoteCard("Sample data — Lost & Found is not wired to a backend yet.") }
        item {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(selected = filter == null, onClick = { filter = null }, label = { Text("All") })
                LostFoundType.entries.forEach { type ->
                    FilterChip(
                        selected = filter == type,
                        onClick = { filter = type },
                        label = { Text(type.label) },
                    )
                }
            }
        }
        items(items, key = { it.id }) { item ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(14.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(item.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                            Text(item.type.label, style = MaterialTheme.typography.labelSmall, color = Slate500)
                        }
                        StatusBadge(
                            if (item.active) "Active" else "Resolved",
                            if (item.active) {
                                BadgeTone.WARN
                            } else {
                                BadgeTone.SUCCESS
                            },
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(item.description, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    Text("${item.location} · ${item.date}", style = MaterialTheme.typography.labelSmall, color = Slate500)
                    Text(item.contact, style = MaterialTheme.typography.labelSmall, color = Slate500)
                    if (item.active) {
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(onClick = { onContact(item.contact) }) { Text("Contact") }
                    }
                }
            }
        }
    }
}

/* ---------- Emotional Support (sample) ---------- */

@Composable
private fun EmotionalTab(onCallHelpline: (String) -> Unit, onTalkToSaathi: () -> Unit) {
    var activeBreathing by remember { mutableStateOf<Int?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "You don't have to go through recovery alone.",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "These tools support you — they are not a substitute for professional care. " +
                            "Sample content, matching the web.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                    )
                }
            }
        }

        item { SectionLabel("Guided breathing") }
        SupportSamples.breathing.forEachIndexed { index, exercise ->
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(14.dp)) {
                        Text(exercise.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        exercise.duration?.let {
                            Text(it, style = MaterialTheme.typography.labelSmall, color = Slate500)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(exercise.description, style = MaterialTheme.typography.bodySmall, color = Slate500)
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = {
                                activeBreathing = if (activeBreathing == index) null else index
                            },
                        ) {
                            Text(if (activeBreathing == index) "Stop" else "Start")
                        }
                    }
                }
            }
        }

        item { SectionLabel("Grounding exercises") }
        items(SupportSamples.grounding, key = { it.title }) { exercise ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(14.dp)) {
                    Text(exercise.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    Text(exercise.description, style = MaterialTheme.typography.bodySmall, color = Slate500)
                }
            }
        }

        item { SectionLabel("Connect & get support") }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(14.dp)) {
                    Text("Talk to Saathi", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                    Text(
                        "A supportive AI companion that can listen and share simple coping ideas.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = onTalkToSaathi) { Text("Start conversation") }
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(14.dp)) {
                    Text("Helpline numbers", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                    Text("Free, confidential support lines available 24/7.", style = MaterialTheme.typography.bodySmall, color = Slate500)
                    Spacer(Modifier.height(8.dp))
                    SupportSamples.helplines.forEach { line ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(line.name, style = MaterialTheme.typography.bodySmall)
                            OutlinedButton(onClick = { onCallHelpline(line.number) }) { Text(line.number) }
                        }
                    }
                }
            }
        }
        item {
            Text(
                "These resources are for emotional support and coping — not medical advice. " +
                    "If you are in crisis, call 112 or go to your nearest hospital.",
                style = MaterialTheme.typography.bodySmall,
                color = Slate500,
            )
        }
    }
}

/* ---------- Saathi chat ---------- */

@Composable
private fun SaathiChat(turns: List<ChatTurn>, sending: Boolean, onSend: (String) -> Unit) {
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(turns.size, sending) {
        listState.animateScrollToItem((turns.size - 1).coerceAtLeast(0))
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(480.dp)) {
        Text("Talk to Saathi", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(
            "An AI companion — not a human volunteer or a substitute for professional care. In a crisis, call 112.",
            style = MaterialTheme.typography.labelSmall,
            color = Slate500,
        )
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(turns.size) { i ->
                val turn = turns[i]
                val fromUser = turn.role == ChatRole.USER
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = if (fromUser) Arrangement.End else Arrangement.Start,
                ) {
                    Text(
                        turn.content,
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (fromUser) Navy700 else Slate100)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (fromUser) Color.White else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
            if (sending) {
                item {
                    Text(
                        "Saathi is typing…",
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(Slate100)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = Slate500,
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("How are you feeling…") },
                maxLines = 3,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            )
            IconButton(
                onClick = {
                    onSend(input)
                    input = ""
                },
                enabled = input.isNotBlank() && !sending,
            ) {
                Icon(Icons.AutoMirrored.Rounded.Send, contentDescription = "Send")
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

/* ---------- shared bits ---------- */

@Composable
private fun NoteCard(text: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Slate100)) {
        Text(
            text,
            modifier = Modifier.padding(14.dp),
            style = MaterialTheme.typography.bodySmall,
            color = Slate500,
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
}
