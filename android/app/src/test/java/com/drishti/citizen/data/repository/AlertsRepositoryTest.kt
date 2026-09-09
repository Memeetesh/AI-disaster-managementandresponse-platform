package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.data.remote.dto.AlertDto
import com.drishti.citizen.testing.FakeApiService
import com.drishti.citizen.testing.FakeResponseCache
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class AlertsRepositoryTest {

    private val sample = listOf(
        AlertDto(1, "imd", "flood", "high", "Heavy rain expected", "2026-09-01T10:00:00Z"),
    )

    private class StubApi(private val block: suspend () -> List<AlertDto>) : FakeApiService() {
        override suspend fun alerts(): List<AlertDto> = block()
    }

    @Test
    fun `network success returns Fresh and populates the cache`() = runTest {
        val cache = FakeResponseCache(now = { 111L })
        val repo = AlertsRepository(StubApi { sample }, cache)

        val result = repo.alerts()

        assertTrue(result is DataResult.Fresh)
        assertEquals(sample, result.dataOrNull)
        // second call, now offline, should still serve the snapshot
        val offline = AlertsRepository(StubApi { throw IOException("down") }, cache).alerts()
        assertTrue(offline is DataResult.Stale)
        assertEquals(111L, (offline as DataResult.Stale).cachedAtEpochMs)
        assertEquals(sample, offline.data)
    }

    @Test
    fun `network failure with no cache returns Failure`() = runTest {
        val repo = AlertsRepository(StubApi { throw IOException("down") }, FakeResponseCache())

        val result = repo.alerts()

        assertTrue(result is DataResult.Failure)
        assertEquals(0, (result as DataResult.Failure).error.status)
    }
}
