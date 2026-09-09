package com.drishti.citizen.core.geo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GeoTest {

    // A unit square in [lon, lat] order, matching GeoJSON ring coordinates.
    private val square = listOf(
        listOf(0.0, 0.0),
        listOf(2.0, 0.0),
        listOf(2.0, 2.0),
        listOf(0.0, 2.0),
        listOf(0.0, 0.0),
    )

    @Test
    fun `point inside the ring`() {
        assertTrue(Geo.pointInPolygon(lat = 1.0, lon = 1.0, ring = square))
    }

    @Test
    fun `point outside the ring`() {
        assertFalse(Geo.pointInPolygon(lat = 3.0, lon = 1.0, ring = square))
        assertFalse(Geo.pointInPolygon(lat = 1.0, lon = -0.5, ring = square))
    }

    @Test
    fun `degenerate ring is never inside`() {
        assertFalse(Geo.pointInPolygon(0.5, 0.5, listOf(listOf(0.0, 0.0), listOf(1.0, 1.0))))
    }

    @Test
    fun `haversine matches a known distance`() {
        // ~1 degree of latitude ≈ 111 km.
        val km = Geo.haversineKm(13.0, 80.0, 14.0, 80.0)
        assertEquals(111.2, km, 1.0)
    }

    @Test
    fun `haversine is zero for the same point`() {
        assertEquals(0.0, Geo.haversineKm(13.05, 80.25, 13.05, 80.25), 1e-9)
    }
}
