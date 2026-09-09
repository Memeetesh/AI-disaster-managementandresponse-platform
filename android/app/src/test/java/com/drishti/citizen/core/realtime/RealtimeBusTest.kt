package com.drishti.citizen.core.realtime

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RealtimeBusTest {

    @Test
    fun `emitted events reach a collector`() = runTest(UnconfinedTestDispatcher()) {
        val bus = RealtimeBus()
        val received = mutableListOf<RealtimeEvent>()
        val job = backgroundScope.launch { bus.events.collect { received += it } }

        bus.emit(RealtimeEvent.AlertsChanged)
        bus.emit(RealtimeEvent.Reconnected)

        assertEquals(listOf(RealtimeEvent.AlertsChanged, RealtimeEvent.Reconnected), received)
        job.cancel()
    }

    @Test
    fun `connected reflects the last set value`() {
        val bus = RealtimeBus()
        assertFalse(bus.connected.value)
        bus.setConnected(true)
        assertTrue(bus.connected.value)
        bus.setConnected(false)
        assertFalse(bus.connected.value)
    }
}
