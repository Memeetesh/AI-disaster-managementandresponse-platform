package com.drishti.citizen.data.model

import com.drishti.citizen.core.ui.component.BadgeTone
import com.drishti.citizen.data.remote.dto.FamilyMemberDto

data class FamilyCounts(val safe: Int, val awaiting: Int, val needHelp: Int)

/** Ports the status buckets/config in the web `(citizen)/family` page. */
object FamilyMembers {

    fun statusTone(status: String): BadgeTone = when (status) {
        "safe" -> BadgeTone.SUCCESS
        "needs_help", "in_emergency" -> BadgeTone.DANGER
        "no_checkin" -> BadgeTone.WARN
        else -> BadgeTone.NEUTRAL // invite_pending | invite_declined | not_registered
    }

    fun counts(members: List<FamilyMemberDto>): FamilyCounts = FamilyCounts(
        safe = members.count { it.status == "safe" },
        awaiting = members.count { it.status == "no_checkin" || it.status == "invite_pending" },
        needHelp = members.count { it.status == "needs_help" || it.status == "in_emergency" },
    )

    /** The sub-line under a member's name, mirroring the web's conditional text. */
    fun detailLine(member: FamilyMemberDto, nowEpochMs: Long = System.currentTimeMillis()): String = when {
        member.status == "invite_pending" -> "Waiting for them to accept"
        member.status == "invite_declined" -> "They declined the request"
        !member.onDrishti -> "Not a DRISHTI user"
        member.lastCheckInAt != null -> "Checked in ${Alerts.relativeTime(member.lastCheckInAt, nowEpochMs)}"
        else -> "No check-in yet"
    }

    fun initials(name: String): String =
        name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
            .take(2)
            .joinToString("") { it.first().uppercase() }
            .ifEmpty { "?" }
}
