package com.drishti.citizen.core.realtime

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide fan-out of realtime events. [SseClient] is the only producer;
 * ViewModels collect [events] and re-run their loads. Replaces TanStack
 * Query's key-based cache invalidation on the web.
 */
@Singleton
class RealtimeBus @Inject constructor() {

    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 32)
    val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    fun emit(event: RealtimeEvent) {
        _events.tryEmit(event)
    }

    fun setConnected(value: Boolean) {
        _connected.value = value
    }
}
