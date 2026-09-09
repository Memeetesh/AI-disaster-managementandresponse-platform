package com.drishti.citizen

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.drishti.citizen.core.realtime.SseClient
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class DrishtiApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    // Injected only so the process-scoped SSE connection is created at launch;
    // it manages its own lifecycle off SessionManager.state.
    @Suppress("unused")
    @Inject
    lateinit var sseClient: SseClient

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}
