package com.drishti.citizen.core.network

import com.drishti.citizen.core.cache.ResponseCache
import kotlinx.serialization.KSerializer

/**
 * Network-first, cache-fallback read: hit the API, write the result through
 * to [cache], and return [DataResult.Fresh]. On an [ApiError], return the
 * cached snapshot as [DataResult.Stale] if there is one, else
 * [DataResult.Failure].
 */
suspend fun <T> cachedResource(
    cache: ResponseCache,
    key: String,
    serializer: KSerializer<T>,
    fetch: suspend () -> T,
): DataResult<T> = try {
    val fresh = safeApiCall { fetch() }
    cache.save(key, serializer, fresh)
    DataResult.Fresh(fresh)
} catch (e: ApiError) {
    when (val hit = cache.load(key, serializer)) {
        null -> DataResult.Failure(e)
        else -> DataResult.Stale(hit.value, hit.fetchedAtEpochMs, e)
    }
}
