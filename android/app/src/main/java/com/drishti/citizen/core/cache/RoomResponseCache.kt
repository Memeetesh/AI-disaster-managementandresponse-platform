package com.drishti.citizen.core.cache

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RoomResponseCache @Inject constructor(
    private val dao: CachedResponseDao,
    private val json: Json,
) : ResponseCache {

    override suspend fun <T> load(key: String, serializer: KSerializer<T>): CacheHit<T>? =
        withContext(Dispatchers.IO) {
            val row = dao.get(key) ?: return@withContext null
            runCatching { json.decodeFromString(serializer, row.json) }
                .map { CacheHit(it, row.fetchedAtEpochMs) }
                .getOrNull() // a stale/incompatible snapshot is treated as a miss
        }

    override suspend fun <T> save(key: String, serializer: KSerializer<T>, value: T) {
        withContext(Dispatchers.IO) {
            dao.upsert(
                CachedResponse(
                    key = key,
                    json = json.encodeToString(serializer, value),
                    fetchedAtEpochMs = System.currentTimeMillis(),
                ),
            )
        }
    }

    override suspend fun clear() {
        withContext(Dispatchers.IO) { dao.clear() }
    }
}
