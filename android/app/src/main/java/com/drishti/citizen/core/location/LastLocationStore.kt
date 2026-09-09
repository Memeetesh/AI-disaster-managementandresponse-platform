package com.drishti.citizen.core.location

import android.content.Context
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

private val Context.locationDataStore by preferencesDataStore(name = "drishti_location")

/**
 * Remembers the last resolved fix so a screen can render against it while a
 * fresh one is being acquired — the web's `useLocation` has no such cache.
 */
@Singleton
class LastLocationStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val LAT = doublePreferencesKey("last_lat")
        val LON = doublePreferencesKey("last_lon")
        val AT = longPreferencesKey("last_at")
    }

    suspend fun peek(): LatLon? {
        val prefs = context.locationDataStore.data.first()
        val lat = prefs[Keys.LAT] ?: return null
        val lon = prefs[Keys.LON] ?: return null
        return LatLon(lat, lon)
    }

    suspend fun save(location: LatLon) {
        context.locationDataStore.edit { prefs ->
            prefs[Keys.LAT] = location.lat
            prefs[Keys.LON] = location.lon
            prefs[Keys.AT] = System.currentTimeMillis()
        }
    }
}
