package com.drishti.citizen.feature.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Article
import androidx.compose.material.icons.rounded.Emergency
import androidx.compose.material.icons.rounded.Group
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.ui.graphics.vector.ImageVector

/** The five bottom-nav tabs — mirrors `mobileNavItems` in the web app's citizen layout. */
enum class TopLevelDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    HOME("home", "Home", Icons.Rounded.Home),
    REPORTS("reports", "Reports", Icons.AutoMirrored.Rounded.Article),
    EMERGENCY("emergency", "SOS", Icons.Rounded.Emergency),
    FAMILY("family", "Family", Icons.Rounded.Group),
    SUPPORT("support", "Support", Icons.Rounded.VolunteerActivism),
    ;

    companion object {
        val routes: Set<String> = entries.map { it.route }.toSet()

        fun fromRoute(route: String?): TopLevelDestination? =
            entries.firstOrNull { it.route == route }
    }
}
