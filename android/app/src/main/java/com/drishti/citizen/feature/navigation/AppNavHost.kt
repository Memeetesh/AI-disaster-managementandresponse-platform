package com.drishti.citizen.feature.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.drishti.citizen.feature.emergency.EmergencyScreen
import com.drishti.citizen.feature.family.FamilyScreen
import com.drishti.citizen.feature.home.HomeScreen
import com.drishti.citizen.feature.reports.MyReportsScreen
import com.drishti.citizen.feature.support.SupportScreen

@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = TopLevelDestination.HOME.route,
        modifier = modifier,
    ) {
        composable(TopLevelDestination.HOME.route) { HomeScreen() }
        composable(TopLevelDestination.REPORTS.route) { MyReportsScreen() }
        composable(TopLevelDestination.EMERGENCY.route) { EmergencyScreen() }
        composable(TopLevelDestination.FAMILY.route) { FamilyScreen() }
        composable(TopLevelDestination.SUPPORT.route) { SupportScreen() }
    }
}
