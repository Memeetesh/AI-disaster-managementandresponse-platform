package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.data.remote.dto.IncidentDto
import com.drishti.citizen.testing.FakeApiService
import com.drishti.citizen.testing.FakeResponseCache
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class IncidentsRepositoryTest {

    private val sample = listOf(
        IncidentDto(
            id = 12, type = "flood", latitude = 13.0, longitude = 80.2, severity = "moderate",
            status = "reported", description = "Road flooded", createdAt = "2026-09-01T10:00:00Z",
        ),
    )

    private class StubApi(private val block: suspend () -> List<IncidentDto>) : FakeApiService() {
        override suspend fun incidents(limit: Int?): List<IncidentDto> = block()
    }

    @Test
    fun `myReports returns Fresh and fills the cache for the next offline read`() = runTest {
        val cache = FakeResponseCache(now = { 900L })
        val fresh = IncidentsRepository(StubApi { sample }, cache).myReports()
        assertTrue(fresh is DataResult.Fresh)
        assertEquals(sample, fresh.dataOrNull)

        val offline = IncidentsRepository(StubApi { throw IOException("offline") }, cache).myReports()
        assertTrue(offline is DataResult.Stale)
        assertEquals(900L, (offline as DataResult.Stale).cachedAtEpochMs)
        assertEquals(sample, offline.data)
    }

    @Test
    fun `myReports with no cache and no network is a Failure`() = runTest {
        val result = IncidentsRepository(StubApi { throw IOException("offline") }, FakeResponseCache())
            .myReports()

        assertTrue(result is DataResult.Failure)
        assertEquals(0, (result as DataResult.Failure).error.status)
    }

    @Test
    fun `incident round-trips a single row`() = runTest {
        val api = object : FakeApiService() {
            override suspend fun incident(id: Int): IncidentDto = sample.first().copy(id = id, status = "verified")
        }
        val incident = IncidentsRepository(api, FakeResponseCache()).incident(12)
        assertNotNull(incident)
        assertEquals("verified", incident.status)
    }

    @Test
    fun `submitSos sends the emergency multipart fields`() = runTest {
        var sentPeople: String? = null
        val api = object : FakeApiService() {
            override suspend fun submitSos(
                latitude: okhttp3.RequestBody,
                longitude: okhttp3.RequestBody,
                peopleAffected: okhttp3.RequestBody,
                description: okhttp3.RequestBody?,
            ): IncidentDto {
                sentPeople = peopleAffected.readText()
                return sample.first().copy(id = 99, severity = "critical", status = "reported")
            }
        }
        val incident = IncidentsRepository(api, FakeResponseCache())
            .submitSos(13.0, 80.2, peopleAffected = 1, description = "help")
        assertEquals(99, incident.id)
        assertEquals("critical", incident.severity)
        assertEquals("1", sentPeople)
    }

    private fun okhttp3.RequestBody.readText(): String {
        val buffer = okio.Buffer()
        writeTo(buffer)
        return buffer.readUtf8()
    }
}
