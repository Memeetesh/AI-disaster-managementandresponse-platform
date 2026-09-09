package com.drishti.citizen.feature.root

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.drishti.citizen.core.auth.AuthState
import com.drishti.citizen.feature.auth.AuthScreen
import com.drishti.citizen.feature.navigation.AppRoot

/**
 * Top-level switch: while the stored token is being validated we show a
 * splash, then either the auth screen or the signed-in app shell. A forced
 * sign-out (401) flips [AuthState] back to [AuthState.SignedOut] and the app
 * graph is torn down automatically.
 */
@Composable
fun DrishtiRoot(viewModel: RootViewModel = hiltViewModel()) {
    val authState by viewModel.authState.collectAsStateWithLifecycle()

    when (authState) {
        AuthState.Loading -> SplashScreen()
        AuthState.SignedOut -> AuthScreen()
        is AuthState.SignedIn -> AppRoot(onSignOut = viewModel::signOut)
    }
}

@Composable
private fun SplashScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}
