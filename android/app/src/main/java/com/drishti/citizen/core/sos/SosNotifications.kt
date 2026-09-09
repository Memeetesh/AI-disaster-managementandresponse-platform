package com.drishti.citizen.core.sos

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.getSystemService
import androidx.work.ForegroundInfo

/**
 * The "SOS queued" notification shown while [SosUploadWorker] retries an
 * offline send. Kept deliberately blunt: a queued SOS is *not yet delivered*,
 * and the copy must never imply otherwise.
 */
object SosNotifications {

    private const val CHANNEL_ID = "sos_delivery"
    const val NOTIFICATION_ID = 4201

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService<NotificationManager>() ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "SOS delivery",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Status of an SOS that is waiting to send" },
        )
    }

    fun foregroundInfo(context: Context): ForegroundInfo {
        ensureChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("SOS queued")
            .setContentText("Waiting for a connection — it will send automatically.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    fun clear(context: Context) {
        context.getSystemService<NotificationManager>()?.cancel(NOTIFICATION_ID)
    }
}
