package com.drishti.citizen.core.sos

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.data.repository.IncidentsRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Delivers an SOS that couldn't go out immediately. Enqueued by [SosQueue]
 * with a `CONNECTED` constraint, so it fires as soon as the network returns —
 * the real version of the web's "offline mode" note.
 */
@HiltWorker
class SosUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val incidentsRepository: IncidentsRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun getForegroundInfo(): ForegroundInfo =
        SosNotifications.foregroundInfo(applicationContext)

    override suspend fun doWork(): Result {
        val lat = inputData.getDouble(KEY_LAT, Double.NaN)
        val lon = inputData.getDouble(KEY_LON, Double.NaN)
        if (lat.isNaN() || lon.isNaN()) return Result.failure()
        val people = inputData.getInt(KEY_PEOPLE, 1)
        val description = inputData.getString(KEY_DESCRIPTION)?.takeIf { it.isNotBlank() }

        return try {
            incidentsRepository.submitSos(lat, lon, people, description)
            SosNotifications.clear(applicationContext)
            Result.success()
        } catch (e: ApiError) {
            if (e.isNetwork) Result.retry() else Result.failure()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val UNIQUE_PREFIX = "sos-upload"
        private const val KEY_LAT = "lat"
        private const val KEY_LON = "lon"
        private const val KEY_PEOPLE = "people"
        private const val KEY_DESCRIPTION = "description"

        fun inputData(lat: Double, lon: Double, people: Int, description: String?) = workDataOf(
            KEY_LAT to lat,
            KEY_LON to lon,
            KEY_PEOPLE to people,
            KEY_DESCRIPTION to description.orEmpty(),
        )
    }
}
