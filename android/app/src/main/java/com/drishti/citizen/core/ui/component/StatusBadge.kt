package com.drishti.citizen.core.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.drishti.citizen.core.ui.theme.Danger100
import com.drishti.citizen.core.ui.theme.Danger600
import com.drishti.citizen.core.ui.theme.Navy100
import com.drishti.citizen.core.ui.theme.Navy700
import com.drishti.citizen.core.ui.theme.Safe100
import com.drishti.citizen.core.ui.theme.Safe600
import com.drishti.citizen.core.ui.theme.Slate100
import com.drishti.citizen.core.ui.theme.Slate700
import com.drishti.citizen.core.ui.theme.Warn100
import com.drishti.citizen.core.ui.theme.Warn600

/** Colour intent for a small status/severity pill. */
enum class BadgeTone { NEUTRAL, INFO, WARN, DANGER, SUCCESS }

private fun BadgeTone.colors(): Pair<Color, Color> = when (this) {
    BadgeTone.NEUTRAL -> Slate700 to Slate100
    BadgeTone.INFO -> Navy700 to Navy100
    BadgeTone.WARN -> Warn600 to Warn100
    BadgeTone.DANGER -> Danger600 to Danger100
    BadgeTone.SUCCESS -> Safe600 to Safe100
}

@Composable
fun StatusBadge(text: String, tone: BadgeTone, modifier: Modifier = Modifier) {
    val (fg, bg) = tone.colors()
    Text(
        text = text,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = fg,
    )
}
