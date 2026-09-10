package com.drishti.citizen.data.model

import com.drishti.citizen.core.ui.component.BadgeTone
import com.drishti.citizen.data.remote.dto.FamilyMemberDto
import org.junit.Assert.assertEquals
import org.junit.Test

class FamilyMembersTest {

    private fun member(status: String, onDrishti: Boolean = true, lastCheckIn: String? = null) =
        FamilyMemberDto(
            id = status.hashCode(), name = "Meera Rao", phone = "9998887777", relation = "Sister",
            onDrishti = onDrishti, linkStatus = "accepted", status = status, statusLabel = status,
            lastCheckInAt = lastCheckIn, createdAt = "2026-09-01T00:00:00Z",
        )

    @Test
    fun `status tones`() {
        assertEquals(BadgeTone.SUCCESS, FamilyMembers.statusTone("safe"))
        assertEquals(BadgeTone.DANGER, FamilyMembers.statusTone("needs_help"))
        assertEquals(BadgeTone.DANGER, FamilyMembers.statusTone("in_emergency"))
        assertEquals(BadgeTone.WARN, FamilyMembers.statusTone("no_checkin"))
        assertEquals(BadgeTone.NEUTRAL, FamilyMembers.statusTone("invite_pending"))
        assertEquals(BadgeTone.NEUTRAL, FamilyMembers.statusTone("not_registered"))
    }

    @Test
    fun `counts bucket the circle like the web`() {
        val counts = FamilyMembers.counts(
            listOf(
                member("safe"),
                member("safe"),
                member("no_checkin"),
                member("invite_pending"),
                member("needs_help"),
                member("in_emergency"),
                member("invite_declined"),
            ),
        )
        assertEquals(2, counts.safe)
        assertEquals(2, counts.awaiting)
        assertEquals(2, counts.needHelp)
    }

    @Test
    fun `detail line follows the web's conditionals`() {
        assertEquals("Waiting for them to accept", FamilyMembers.detailLine(member("invite_pending")))
        assertEquals("They declined the request", FamilyMembers.detailLine(member("invite_declined")))
        assertEquals("Not on Aasha Setu", FamilyMembers.detailLine(member("no_checkin", onDrishti = false)))
        assertEquals("No check-in yet", FamilyMembers.detailLine(member("no_checkin")))

        val now = java.time.Instant.parse("2026-09-09T12:00:00Z").toEpochMilli()
        assertEquals(
            "Checked in 5m ago",
            FamilyMembers.detailLine(member("safe", lastCheckIn = "2026-09-09T11:55:00Z"), now),
        )
    }

    @Test
    fun `initials take up to two words`() {
        assertEquals("MR", FamilyMembers.initials("meera rao"))
        assertEquals("A", FamilyMembers.initials("Asha"))
        assertEquals("?", FamilyMembers.initials("   "))
    }
}
