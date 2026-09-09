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
     * A fresh fix if permission is granted and the hardware answers, else the
     * last cached fix, else null. Never throws.
     */
    @SuppressLint("MissingPermission")
    suspend fun currentFix(): LatLon? {
        if (!hasPermission()) return lastLocationStore.peek()

        val fresh = runCatching { requestCurrent() }.getOrNull()
            ?: runCatching { fusedClient.lastLocation.awaitResult() }.getOrNull()?.toLatLon()

        if (fresh != null) {
            lastLocationStore.save(fresh)
            return fresh
        }
        return lastLocationStore.peek()
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestCurrent(): LatLon? {
        val cancellation = CancellationTokenSource()
        return fusedClient
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
            .awaitResult()
            ?.toLatLon()
    }

    private fun Location.toLatLon() = LatLon(latitude, longitude)

    private companion object {
        val PERMISSIONS = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
    }
}
