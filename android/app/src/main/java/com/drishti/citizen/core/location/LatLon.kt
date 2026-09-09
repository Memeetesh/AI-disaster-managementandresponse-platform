package com.drishti.citizen.core.location

import java.util.Locale

/** A single location fix. */
data class LatLon(val lat: Double, val lon: Double) {

    /**
     * Coarse key for per-location caching — ~100 m buckets, so tiny GPS
     * jitter doesn't blow the cache between reads.
     */
    fun cacheKey(): String = String.format(Locale.US, "%.3f,%.3f", lat, lon)
}
