package com.drishti.citizen.core.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The web citizen app is light-only; mirror that for now. A dark scheme can
// be added later behind the same entry point.
private val DrishtiLightColors = lightColorScheme(
    primary = Navy700,
    onPrimary = Color.White,
    primaryContainer = Navy100,
    onPrimaryContainer = Navy900,
    secondary = Navy600,
    onSecondary = Color.White,
    tertiary = Support600,
    onTertiary = Color.White,
    background = Slate50,
    onBackground = Slate900,
    surface = Color.White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate500,
    outline = Slate200,
    error = Danger600,
    onError = Color.White,
    errorContainer = Danger100,
    onErrorContainer = Danger600,
)

@Composable
fun DrishtiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DrishtiLightColors,
        typography = DrishtiTypography,
        content = content,
    )
}
