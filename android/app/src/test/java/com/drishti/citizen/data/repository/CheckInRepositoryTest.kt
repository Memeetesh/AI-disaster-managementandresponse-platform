package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.data.remote.dto.CheckInDto
import com.drishti.citizen.data.remote.dto.CheckInRequest
import com.drishti.citizen.testing.FakeApiService
import com.drishti.citizen.testing.FakeResponseCache
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class CheckInRepositoryTest {

    private val safe = CheckInDto(
        id = 3, userId = 7, status = "safe", latitude = 13.0, longitude = 80.2,
        createdAt = "2026-09-09T08:00:00Z",
    )

    private class StubApi(private val block: suspend () -> CheckInDto?) : FakeApiService() {
        override suspend fun myCheckIn(): CheckInDto? = block()
        override suspend fun createCheckIn(body: CheckInRequest): CheckInDto =
            safeStub.copy(latitude = body.latitude, longitude = body.longitude)

        companion object {
            val safeStub = CheckInDto(9, 7, "safe", null, null, "2026-09-09T09:00:00Z")
        }
    }

    @Test
    fun `myCheckIn caches a non-null payload and serves it stale when offline`() = runTest {
        val cache = FakeResponseCache(now = { 42L })
        val fresh = CheckInRepository(StubApi { safe }, cache).myCheckIn()
        assertTrue(fresh is DataResult.Fresh)
        assertEquals(safe, fresh.dataOrNull)

        val offline = CheckInRepository(StubApi { throw IOException("x") }, cache).myCheckIn()
        assertTrue(offline is DataResult.Stale)
        assertEquals(safe, (offline as DataResult.Stale).data)
        assertEquals(42L, offline.cachedAtEpochMs)
    }

    @Test
    fun `myCheckIn round-trips a null payload`() = runTest {
        val result = CheckInRepository(StubApi { null }, FakeResponseCache()).myCheckIn()
        assertTrue(result is DataResult.Fresh)
        assertNull(result.dataOrNull)
    }

    @Test
    fun `markSafe forwards the coordinates`() = runTest {
        val checkIn = CheckInRepository(StubApi { null }, FakeResponseCache()).markSafe(1.0, 2.0)
        assertEquals("safe", checkIn.status)
        assertEquals(1.0, checkIn.latitude!!, 1e-9)
        assertEquals(2.0, checkIn.longitude!!, 1e-9)
    }
}
