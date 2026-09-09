package com.drishti.citizen.core.geo

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Ports `frontend/src/lib/geo.ts`. */
object Geo {

    private const val EARTH_RADIUS_KM = 6371.0

    fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = (lat2 - lat1) * PI / 180
        val dLon = (lon2 - lon1) * PI / 180
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(lat1 * PI / 180) * cos(lat2 * PI / 180) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
    }

    /**
     * Ray-casting point-in-polygon on a single GeoJSON ring (no holes — fine
     * for the demo's square grid cells). Ring points are `[lon, lat]`.
     */
    fun pointInPolygon(lat: Double, lon: Double, ring: List<List<Double>>): Boolean {
        if (ring.size < 3) return false
        var inside = false
        var j = ring.size - 1
        for (i in ring.indices) {
            val xi = ring[i][0]
            val yi = ring[i][1]
            val xj = ring[j][0]
            val yj = ring[j][1]
            val intersects = (yi > lat) != (yj > lat) &&
                lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
            if (intersects) inside = !inside
            j = i
        }
        return inside
    }
}
