package com.drishti.citizen.core.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import javax.inject.Inject
import javax.inject.Singleton

/**
 * `navigator.geolocation` for a native client: one high-accuracy fix, cached
 * for next time. `ACCESS_BACKGROUND_LOCATION` is deliberately not used.
 */
@Singleton
class LocationProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val fusedClient: FusedLocationProviderClient,
    private val lastLocationStore: LastLocationStore,
) {

    fun hasPermission(): Boolean =
        PERMISSIONS.any {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    /**
     * True only if the user granted *precise* location. With just "approximate"
     * a fix can be off by a kilometre or more — no good for an SOS.
     */
    fun hasPreciseLocation(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /**
     * A fresh fix if permission is granted and the hardware answers, else the
     * last cached fix, else null. Never throws. Fine for maps / nearby lists.
     */
    @SuppressLint("MissingPermission")
    suspend fun currentFix(): LatLon? {
        if (!hasPermission()) return lastLocationStore.peek()

        val fresh = requestCurrent(FRESH_FIX_TIMEOUT_MS)
            ?: runCatching { lastLocation() }.getOrNull()

        if (fresh != null) {
            lastLocationStore.save(fresh)
            return fresh
        }
        return lastLocationStore.peek()
    }

    /**
     * A *current* high-accuracy fix for an SOS: force a new GPS reading, wait
     * up to [EMERGENCY_FIX_TIMEOUT_MS], and return null (never a stale
     * fallback) if it doesn't arrive. The caller decides what to do with null.
     */
    @SuppressLint("MissingPermission")
    suspend fun emergencyFix(): LatLon? {
        if (!hasPermission()) return null
        return requestCurrent(EMERGENCY_FIX_TIMEOUT_MS)?.also { lastLocationStore.save(it) }
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestCurrent(timeoutMs: Long): LatLon? = withTimeoutOrNull(timeoutMs) {
        val cancellation = CancellationTokenSource()
        try {
            suspendCancellableCoroutine { cont ->
                cont.invokeOnCancellation { cancellation.cancel() }
                fusedClient
                    .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
                    .addOnSuccessListener { location -> cont.resume(location?.toLatLon()) }
                    .addOnFailureListener { cont.resume(null) }
                    .addOnCanceledListener { cont.resume(null) }
            }
        } finally {
            cancellation.cancel()
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun lastLocation(): LatLon? = withTimeoutOrNull(LAST_LOCATION_TIMEOUT_MS) {
        suspendCancellableCoroutine { cont ->
            fusedClient.lastLocation
                .addOnSuccessListener { location -> cont.resume(location?.toLatLon()) }
                .addOnFailureListener { cont.resume(null) }
                .addOnCanceledListener { cont.resume(null) }
        }
    }

    private fun Location.toLatLon() = LatLon(latitude, longitude)

    private companion object {
        val PERMISSIONS = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        const val FRESH_FIX_TIMEOUT_MS = 8_000L
        const val EMERGENCY_FIX_TIMEOUT_MS = 12_000L
        const val LAST_LOCATION_TIMEOUT_MS = 3_000L
    }
}
