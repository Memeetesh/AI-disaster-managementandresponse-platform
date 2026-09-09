package com.drishti.citizen.feature.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.drishti.citizen.feature.emergency.EmergencyScreen
import com.drishti.citizen.feature.family.FamilyScreen
import com.drishti.citizen.feature.home.HomeScreen
import com.drishti.citizen.feature.report.ReportScreen
import com.drishti.citizen.feature.reports.MyReportsScreen
import com.drishti.citizen.feature.support.SupportScreen

/** Non-tab routes reachable within the signed-in graph. */
object AppRoute {
    const val REPORT = "report"
}

@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
) {
    fun switchTab(route: String) = navController.navigate(route) {
        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

    NavHost(
        navController = navController,
        startDestination = TopLevelDestination.HOME.route,
        modifier = modifier,
    ) {
        composable(TopLevelDestination.HOME.route) {
            HomeScreen(onOpenSupport = { switchTab(TopLevelDestination.SUPPORT.route) })
        }
        composable(TopLevelDestination.REPORTS.route) {
            MyReportsScreen(onReportIncident = { navController.navigate(AppRoute.REPORT) })
        }
        composable(TopLevelDestination.EMERGENCY.route) { EmergencyScreen() }
        composable(TopLevelDestination.FAMILY.route) { FamilyScreen() }
        composable(TopLevelDestination.SUPPORT.route) { SupportScreen() }

        composable(AppRoute.REPORT) {
            ReportScreen(
                onDone = { navController.popBackStack() },
                onViewReports = {
                    navController.popBackStack()
                    switchTab(TopLevelDestination.REPORTS.route)
                },
            )
        }
    }
}
