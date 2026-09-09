package com.drishti.citizen.core.realtime

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import com.drishti.citizen.BuildConfig
import com.drishti.citizen.core.auth.AuthState
import com.drishti.citizen.core.auth.SessionManager
import com.drishti.citizen.core.di.AppScope
import androidx.core.content.getSystemService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holds one SSE connection to `GET /stream` for the whole app. Connects when
 * [SessionManager] is `SignedIn`, retries with a fixed backoff, reconnects
 * immediately when the network comes back, and disconnects on sign-out.
 * The Bearer header is added by the shared `AuthInterceptor`.
 */
@Singleton
class SseClient @Inject constructor(
    okHttpClient: OkHttpClient,
    sessionManager: SessionManager,
    private val bus: RealtimeBus,
    @ApplicationContext private val context: Context,
    @AppScope private val scope: CoroutineScope,
) {
    // SSE is a long-lived read — kill the default read timeout for this stream.
    private val factory = EventSources.createFactory(
        okHttpClient.newBuilder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .retryOnConnectionFailure(true)
            .build(),
    )

    @Volatile
    private var wantConnection = false
    private var eventSource: EventSource? = null
    private var reconnectJob: Job? = null

    init {
        scope.launch {
            sessionManager.state.collect { state ->
                if (state is AuthState.SignedIn) start() else stop()
            }
        }
        registerNetworkCallback()
    }

    @Synchronized
    private fun start() {
        wantConnection = true
        if (eventSource == null) connect()
    }

    @Synchronized
    private fun stop() {
        wantConnection = false
        reconnectJob?.cancel()
        reconnectJob = null
        eventSource?.cancel()
        eventSource = null
        bus.setConnected(false)
    }

    @Synchronized
    private fun connect() {
        eventSource?.cancel()
        val request = Request.Builder()
            .url(BuildConfig.BASE_URL + "stream")
            .header("Accept", "text/event-stream")
            .build()
        eventSource = factory.newEventSource(request, listener)
    }

    @Synchronized
    private fun scheduleReconnect(immediate: Boolean = false) {
        if (!wantConnection || reconnectJob?.isActive == true) return
        eventSource = null
        reconnectJob = scope.launch {
            if (!immediate) delay(RETRY_MS)
            if (wantConnection) connect()
        }
    }

    private val listener = object : EventSourceListener() {
        override fun onOpen(eventSource: EventSource, response: Response) {
            bus.setConnected(true)
            bus.emit(RealtimeEvent.Reconnected)
        }

        override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
            RealtimeEvent.fromSse(type.orEmpty(), data)?.let(bus::emit)
        }

        override fun onClosed(eventSource: EventSource) {
            bus.setConnected(false)
            scheduleReconnect()
        }

        override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
            bus.setConnected(false)
            scheduleReconnect()
        }
    }

    private fun registerNetworkCallback() {
        val manager = context.getSystemService<ConnectivityManager>() ?: return
        runCatching {
            manager.registerDefaultNetworkCallback(
                object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        if (wantConnection && eventSource == null) scheduleReconnect(immediate = true)
                    }
                },
            )
        }
    }

    private companion object {
        const val RETRY_MS = 3_000L
    }
}
