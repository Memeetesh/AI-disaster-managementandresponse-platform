package com.drishti.citizen.feature.navigation

import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.drishti.citizen.core.ui.theme.Danger600

@Composable
fun DrishtiBottomBar(
    currentRoute: String?,
    onNavigate: (TopLevelDestination) -> Unit,
) {
    NavigationBar(containerColor = Color.White) {
        TopLevelDestination.entries.forEach { dest ->
            val selected = dest.route == currentRoute
            val emergency = dest == TopLevelDestination.EMERGENCY
            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(dest) },
                icon = { Icon(dest.icon, contentDescription = dest.label) },
                label = { Text(dest.label) },
                alwaysShowLabel = true,
                colors = if (emergency) {
                    NavigationBarItemDefaults.colors(
                        selectedIconColor = Danger600,
                        unselectedIconColor = Danger600,
                        selectedTextColor = Danger600,
                        unselectedTextColor = Danger600,
                        indicatorColor = Color.White,
                    )
                } else {
                    NavigationBarItemDefaults.colors()
                },
            )
        }
    }
}
