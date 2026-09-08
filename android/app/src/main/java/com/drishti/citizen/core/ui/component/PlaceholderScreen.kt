package com.drishti.citizen.core.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.drishti.citizen.core.ui.theme.Navy800
import com.drishti.citizen.core.ui.theme.Navy900
import com.drishti.citizen.core.ui.theme.Slate500

@Composable
fun HeroBanner(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Navy800, Navy900)))
            .padding(24.dp),
    ) {
        Column {
            Text(title, style = MaterialTheme.typography.headlineSmall, color = Color.White)
            Spacer(Modifier.height(6.dp))
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.72f),
            )
        }
    }
}

/** Temporary stand-in for a feature screen that lands in a later phase. */
@Composable
fun PlaceholderScreen(
    title: String,
    subtitle: String,
    note: String,
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        HeroBanner(title, subtitle)
        Text(note, style = MaterialTheme.typography.bodyMedium, color = Slate500)
    }
}
