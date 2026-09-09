package com.drishti.citizen.core.auth

import com.drishti.citizen.data.model.User

/** Drives the root navigation switch — mirrors the web `AuthContext` (`user` + `loading`). */
sealed interface AuthState {

    /** Startup: reading the stored token and validating it against `/auth/me`. */
    data object Loading : AuthState

    data object SignedOut : AuthState

    data class SignedIn(val user: User) : AuthState
}
