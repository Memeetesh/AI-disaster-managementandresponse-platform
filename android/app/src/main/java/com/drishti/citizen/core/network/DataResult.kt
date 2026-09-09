package com.drishti.citizen.core.network

/**
 * Outcome of a cached network read (see [cachedResource]):
 * - [Fresh]   — served from the network this call.
 * - [Stale]   — the network failed but a cached snapshot was returned.
 * - [Failure] — the network failed and there was nothing cached.
 *
 * The web app only fakes offline reads; this is the real thing.
 */
sealed interface DataResult<out T> {

    val dataOrNull: T?

    data class Fresh<T>(val data: T) : DataResult<T> {
        override val dataOrNull: T get() = data
    }

    data class Stale<T>(
        val data: T,
        val cachedAtEpochMs: Long,
        val cause: ApiError,
    ) : DataResult<T> {
        override val dataOrNull: T get() = data
    }

    data class Failure(val error: ApiError) : DataResult<Nothing> {
        override val dataOrNull: Nothing? get() = null
    }
}
