package com.drishti.citizen.core.cache

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * Offline read cache. `exportSchema = false` for now — there are no
 * migrations yet and the only table is a disposable response snapshot store
 * (destructive fallback is fine). Revisit when typed entities land.
 */
@Database(entities = [CachedResponse::class], version = 1, exportSchema = false)
abstract class DrishtiDatabase : RoomDatabase() {
    abstract fun cachedResponseDao(): CachedResponseDao
}
