package com.drishti.citizen.feature.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppRoot(onSignOut: () -> Unit = {}) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val currentTab = TopLevelDestination.fromRoute(currentRoute)

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(currentTab?.label ?: "DRISHTI") },
                actions = {
                    IconButton(onClick = onSignOut) {
                        Icon(
                            Icons.AutoMirrored.Rounded.Logout,
                            contentDescription = "Sign out",
                        )
                    }
                },
            )
        },
        bottomBar = {
            if (currentRoute in TopLevelDestination.routes) {
                DrishtiBottomBar(
                    currentRoute = currentRoute,
                    onNavigate = { dest ->
                        navController.navigate(dest.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) { innerPadding ->
        AppNavHost(
            navController = navController,
            modifier = Modifier.padding(innerPadding),
        )
    }
}
