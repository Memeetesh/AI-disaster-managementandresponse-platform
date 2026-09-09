package com.drishti.citizen.data.model

import com.drishti.citizen.data.model.SupportSamples.LostFoundType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportSamplesTest {

    @Test
    fun `sample lists match the web`() {
        assertEquals(4, SupportSamples.lostFound.size)
        assertEquals(3, SupportSamples.breathing.size)
        assertEquals(3, SupportSamples.grounding.size)
        assertEquals(2, SupportSamples.helplines.size)
    }

    @Test
    fun `null filter returns everything, a type filter narrows`() {
        assertEquals(4, SupportSamples.lostFound(null).size)
        val missing = SupportSamples.lostFound(LostFoundType.MISSING_PERSON)
        assertEquals(2, missing.size)
        assertTrue(missing.all { it.type == LostFoundType.MISSING_PERSON })
    }

    @Test
    fun `one sample item is resolved`() {
        assertEquals(1, SupportSamples.lostFound.count { !it.active })
    }
}
