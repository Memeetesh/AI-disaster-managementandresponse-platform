package com.drishti.citizen.core.esp

import com.drishti.citizen.core.network.ApiErrorParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

sealed interface EspRelayResult {
    data class Success(val statusCode: Int, val body: String) : EspRelayResult
    data class Failure(val message: String) : EspRelayResult
}

/**
 * Talks straight to the ESP32 offline-SOS gateway (`android/esp_Saarthi.ino`)
 * over whatever WiFi hotspot it's serving — deliberately NOT the app's normal
 * Retrofit/OkHttp stack, which is pinned to `BuildConfig.BASE_URL`. The phone
 * is off that network entirely while using this path; the gateway itself
 * relays to the real backend over its own WiFi connection.
 */
@Singleton
class EspRelayRepository @Inject constructor() {

    // A local hotspot hop should be near-instant; fail fast rather than hang
    // the UI if the phone isn't actually joined to the gateway's WiFi.
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    suspend fun sendSos(
        gatewayIp: String,
        token: String?,
        latitude: Double,
        longitude: Double,
        peopleAffected: Int,
        description: String,
    ): EspRelayResult = withContext(Dispatchers.IO) {
        val form = FormBody.Builder()
            .add("latitude", latitude.toString())
            .add("longitude", longitude.toString())
            .add("people_affected", peopleAffected.toString())
            .add("description", description)
            .build()

        val requestBuilder = Request.Builder()
            .url("http://$gatewayIp/relay")
            .post(form)
        if (!token.isNullOrBlank()) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    EspRelayResult.Success(response.code, text)
                } else {
                    EspRelayResult.Failure(ApiErrorParser.messageFrom(text))
                }
            }
        } catch (_: IOException) {
            EspRelayResult.Failure(
                "Couldn't reach the ESP32 at $gatewayIp — make sure your WiFi is connected to its hotspot.",
            )
        }
    }
}
