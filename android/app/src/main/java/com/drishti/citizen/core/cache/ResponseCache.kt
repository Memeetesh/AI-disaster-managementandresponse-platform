package com.drishti.citizen.core.cache

import kotlinx.serialization.KSerializer

/**
 * A tiny key → JSON snapshot store for GET responses, so read-only screens
 * can render the last-known payload when the backend is unreachable.
 * Snapshots are the serialized DTOs themselves — same shape as the wire.
 */
interface ResponseCache {

    suspend fun <T> load(key: String, serializer: KSerializer<T>): CacheHit<T>?

    suspend fun <T> save(key: String, serializer: KSerializer<T>, value: T)

    /** Wipe everything — call on sign-out so the next account starts clean. */
    suspend fun clear()
}

data class CacheHit<T>(val value: T, val fetchedAtEpochMs: Long)
