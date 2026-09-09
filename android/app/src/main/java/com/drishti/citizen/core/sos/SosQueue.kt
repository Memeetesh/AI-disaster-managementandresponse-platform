package com.drishti.citizen.core.sos

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/** Queues an SOS for delivery once the device is back online. */
@Singleton
class SosQueue @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun enqueue(latitude: Double, longitude: Double, peopleAffected: Int, description: String?) {
        val request = OneTimeWorkRequestBuilder<SosUploadWorker>()
            .setInputData(SosUploadWorker.inputData(latitude, longitude, peopleAffected, description))
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
            .build()

        // A per-SOS unique name so two queued alerts don't collide.
        WorkManager.getInstance(context).enqueueUniqueWork(
            "${SosUploadWorker.UNIQUE_PREFIX}-${System.currentTimeMillis()}",
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}
