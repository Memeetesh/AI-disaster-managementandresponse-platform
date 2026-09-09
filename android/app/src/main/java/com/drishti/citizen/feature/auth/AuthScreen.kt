package com.drishti.citizen.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.drishti.citizen.core.ui.theme.Danger600
import com.drishti.citizen.core.ui.theme.Navy700
import com.drishti.citizen.core.ui.theme.Navy900
import com.drishti.citizen.core.ui.theme.Slate500

/**
 * Login / register — the Android counterpart of `frontend/src/app/login` and
 * `/register`. Self-registration only ever creates a `citizen` account
 * (enforced server-side); a successful call hands off to [AuthViewModel]
 * which signs in and lets the root navigation swap to the app graph.
 */
@Composable
fun AuthScreen(viewModel: AuthViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(Navy900, Navy700))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "DRISHTI",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Stay informed. Stay safe.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.72f),
            )
            Spacer(Modifier.height(24.dp))

            ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp)) {
                    TabRow(selectedTabIndex = state.mode.ordinal) {
                        Tab(
                            selected = state.mode == AuthMode.LOGIN,
                            onClick = { viewModel.setMode(AuthMode.LOGIN) },
                            text = { Text("Sign in") },
                        )
                        Tab(
                            selected = state.mode == AuthMode.REGISTER,
                            onClick = { viewModel.setMode(AuthMode.REGISTER) },
                            text = { Text("Register") },
                        )
                    }

                    Spacer(Modifier.height(20.dp))

                    if (state.mode == AuthMode.REGISTER) {
                        Text(
                            "Responder and admin accounts are provisioned separately by a command-center admin.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Slate500,
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = state.name,
                            onValueChange = viewModel::setName,
                            label = { Text("Full name") },
                            singleLine = true,
                            enabled = !state.submitting,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(12.dp))
                    }

                    OutlinedTextField(
                        value = state.phone,
                        onValueChange = viewModel::setPhone,
                        label = { Text("Phone number") },
                        singleLine = true,
                        enabled = !state.submitting,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (state.mode == AuthMode.REGISTER) {
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = state.email,
                            onValueChange = viewModel::setEmail,
                            label = { Text("Email (optional)") },
                            singleLine = true,
                            enabled = !state.submitting,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = state.password,
                        onValueChange = viewModel::setPassword,
                        label = { Text("Password") },
                        singleLine = true,
                        enabled = !state.submitting,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done,
                        ),
                        supportingText = if (state.mode == AuthMode.REGISTER) {
                            { Text("At least 8 characters") }
                        } else {
                            null
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    state.error?.let { message ->
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodySmall,
                            color = Danger600,
                        )
                    }

                    Spacer(Modifier.height(20.dp))
                    Button(
                        onClick = viewModel::submit,
                        enabled = state.canSubmit,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (state.submitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = Color.White,
                            )
                        } else {
                            Text(if (state.mode == AuthMode.LOGIN) "Sign in" else "Create account")
                        }
                    }
                }
            }
        }
    }
}
