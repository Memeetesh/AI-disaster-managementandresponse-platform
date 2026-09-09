package com.drishti.citizen.core.network

/**
 * Normalized API failure — the Kotlin counterpart of `ApiError` in
 * `frontend/src/lib/api.ts`. [status] is the HTTP code, or 0 for a
 * transport failure (no response).
 */
class ApiError(
    val status: Int,
    override val message: String,
) : Exception(message) {

    val isUnauthorized: Boolean get() = status == 401

    val isNetwork: Boolean get() = status == 0

    companion object {
        const val GENERIC_MESSAGE = "Something went wrong. Please try again."
        const val NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again."
    }
}
