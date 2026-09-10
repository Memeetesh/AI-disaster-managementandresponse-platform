package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.data.remote.dto.CheckInDto
import com.drishti.citizen.data.remote.dto.CheckInRequest
import com.drishti.citizen.testing.FakeApiService
import com.drishti.citizen.testing.FakeResponseCache
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class CheckInRepositoryTest {

    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    private val safe = CheckInDto(
        id = 3, userId = 7, status = "safe", latitude = 13.0, longitude = 80.2,
        createdAt = "2026-09-09T08:00:00Z",
    )

    private fun body(text: String): ResponseBody = text.toResponseBody("application/json".toMediaType())

    private inner class StubApi(private val block: suspend () -> ResponseBody) : FakeApiService() {
        override suspend fun myCheckIn(): ResponseBody = block()
        override suspend fun createCheckIn(body: CheckInRequest): CheckInDto =
            CheckInDto(9, 7, "safe", body.latitude, body.longitude, "2026-09-09T09:00:00Z")
    }

    private fun repo(api: FakeApiService, cache: FakeResponseCache = FakeResponseCache()) =
        CheckInRepository(api, cache, json)

    @Test
    fun `caches a non-null payload and serves it stale when offline`() = runTest {
        val cache = FakeResponseCache(now = { 42L })
        val fresh = repo(StubApi { body(json.encodeToString(CheckInDto.serializer(), safe)) }, cache).myCheckIn()
        assertTrue(fresh is DataResult.Fresh)
        assertEquals(safe, fresh.dataOrNull)

        val offline = repo(StubApi { throw IOException("x") }, cache).myCheckIn()
        assertTrue(offline is DataResult.Stale)
        assertEquals(safe, (offline as DataResult.Stale).data)
        assertEquals(42L, offline.cachedAtEpochMs)
    }

    @Test
    fun `a literal null body is a real null, not a crash`() = runTest {
        val result = repo(StubApi { body("null") }).myCheckIn()
        assertTrue(result is DataResult.Fresh)
        assertNull(result.dataOrNull)
    }

    @Test
    fun `an empty body is treated as no check-in`() = runTest {
        val result = repo(StubApi { body("") }).myCheckIn()
        assertTrue(result is DataResult.Fresh)
        assertNull(result.dataOrNull)
    }

    @Test
    fun `markSafe forwards the coordinates`() = runTest {
        val checkIn = repo(StubApi { body("null") }).markSafe(1.0, 2.0)
        assertEquals("safe", checkIn.status)
        assertEquals(1.0, checkIn.latitude!!, 1e-9)
        assertEquals(2.0, checkIn.longitude!!, 1e-9)
    }
}
