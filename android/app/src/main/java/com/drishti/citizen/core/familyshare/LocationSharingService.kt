package com.drishti.citizen.core.familyshare

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.getSystemService
import com.drishti.citizen.core.location.LocationProvider
import com.drishti.citizen.data.repository.FamilyRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Pushes the user's location to their family circle every ~2 minutes while
 * opt-in sharing is ON. The web can only ping "while the page is open" — a
 * foreground service does it properly, with a user-visible, always-present
 * notification. Started/stopped from [FamilyViewModel] as the toggle flips.
 */
@AndroidEntryPoint
class LocationSharingService : Service() {

    @Inject
    lateinit var locationProvider: LocationProvider

    @Inject
    lateinit var familyRepository: FamilyRepository

    private val scope = CoroutineScope(SupervisorJob())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundNotification()
        if (scope.isActive && !running) {
            running = true
            scope.launch { pingLoop() }
        }
        return START_STICKY
    }

    private suspend fun pingLoop() {
        while (scope.isActive) {
            val fix = runCatching { locationProvider.currentFix() }.getOrNull()
            if (fix != null) {
                runCatching { familyRepository.ping(fix.lat, fix.lon) }
            }
            delay(PING_INTERVAL_MS)
        }
    }

    private fun startForegroundNotification() {
        ensureChannel()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Sharing your location")
            .setContentText("Your family circle can see your last point. Turn off in the Family tab.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService<NotificationManager>() ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Location sharing", NotificationManager.IMPORTANCE_LOW)
                .apply { description = "Shown while you share your live location with family" },
        )
    }

    override fun onDestroy() {
        running = false
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "location_sharing"
        private const val NOTIFICATION_ID = 5301
        private const val PING_INTERVAL_MS = 120_000L

        @Volatile
        private var running = false

        fun start(context: Context) {
            val intent = Intent(context, LocationSharingService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, LocationSharingService::class.java))
        }
    }
}
