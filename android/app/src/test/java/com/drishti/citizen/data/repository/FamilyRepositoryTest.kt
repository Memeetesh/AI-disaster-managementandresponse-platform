package com.drishti.citizen.data.repository

import com.drishti.citizen.core.location.LatLon
import com.drishti.citizen.core.network.DataResult
import com.drishti.citizen.data.remote.dto.AddFamilyMemberRequest
import com.drishti.citizen.data.remote.dto.FamilyMemberDto
import com.drishti.citizen.testing.FakeApiService
import com.drishti.citizen.testing.FakeResponseCache
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class FamilyRepositoryTest {

    private val meera = FamilyMemberDto(
        id = 1, name = "Meera", phone = "9998887777", relation = "Sister",
        onDrishti = true, linkStatus = "accepted", status = "safe", statusLabel = "Safe",
        createdAt = "2026-09-01T00:00:00Z",
    )

    private class StubApi(
        private val familyBlock: suspend () -> List<FamilyMemberDto> = { emptyList() },
    ) : FakeApiService() {
        var lastAdd: AddFamilyMemberRequest? = null
        override suspend fun family(lat: Double?, lon: Double?): List<FamilyMemberDto> = familyBlock()
        override suspend fun addFamilyMember(body: AddFamilyMemberRequest): FamilyMemberDto {
            lastAdd = body
            return FamilyMemberDto(
                id = 9, name = body.name, phone = body.phone, relation = body.relation,
                linkStatus = "pending", status = "invite_pending", statusLabel = "Invite pending",
                createdAt = "2026-09-09T00:00:00Z",
            )
        }
    }

    @Test
    fun `family caches and serves stale when offline`() = runTest {
        val cache = FakeResponseCache(now = { 7L })
        val fresh = FamilyRepository(StubApi { listOf(meera) }, cache).family(LatLon(13.0, 80.2))
        assertTrue(fresh is DataResult.Fresh)
        assertEquals(listOf(meera), fresh.dataOrNull)

        val offline = FamilyRepository(StubApi { throw IOException("x") }, cache).family(LatLon(13.0, 80.2))
        assertTrue(offline is DataResult.Stale)
        assertEquals(listOf(meera), (offline as DataResult.Stale).data)
        assertEquals(7L, offline.cachedAtEpochMs)
    }

    @Test
    fun `family with no cache and no network is a Failure`() = runTest {
        val result = FamilyRepository(StubApi { throw IOException("x") }, FakeResponseCache())
            .family(null)
        assertTrue(result is DataResult.Failure)
    }

    @Test
    fun `addMember forwards the fields`() = runTest {
        val api = StubApi()
        val member = FamilyRepository(api, FakeResponseCache()).addMember("Ravi", "9990001111", "Brother")
        assertEquals("Ravi", member.name)
        assertEquals("pending", member.linkStatus)
        assertEquals(AddFamilyMemberRequest("Ravi", "9990001111", "Brother"), api.lastAdd)
    }
}
