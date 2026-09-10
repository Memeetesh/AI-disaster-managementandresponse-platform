package com.drishti.citizen.core.network

import kotlinx.serialization.SerializationException
import retrofit2.HttpException
import java.io.IOException

/**
 * Runs a Retrofit call and turns every failure into an [ApiError]:
 * non-2xx (Retrofit throws [HttpException]) → parsed `{detail}` + status,
 * transport failure ([IOException]) → status 0, an unparseable body
 * ([SerializationException]) → status 0. Anything else is a real bug and is
 * left to propagate.
 */
suspend fun <T> safeApiCall(block: suspend () -> T): T =
    try {
        block()
    } catch (e: HttpException) {
        val raw = e.response()?.errorBody()?.string()
        throw ApiError(e.code(), ApiErrorParser.messageFrom(raw))
    } catch (e: IOException) {
        throw ApiError(0, ApiError.NETWORK_MESSAGE)
    } catch (e: SerializationException) {
        throw ApiError(0, "The server sent a response the app couldn't read.")
    }
