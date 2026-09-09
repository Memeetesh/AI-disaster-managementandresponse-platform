package com.drishti.citizen.core.cache

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

@Entity(tableName = "cached_response")
data class CachedResponse(
    @PrimaryKey val key: String,
    val json: String,
    val fetchedAtEpochMs: Long,
)

@Dao
interface CachedResponseDao {

    @Query("SELECT * FROM cached_response WHERE `key` = :key")
    suspend fun get(key: String): CachedResponse?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: CachedResponse)

    @Query("DELETE FROM cached_response")
    suspend fun clear()
}
