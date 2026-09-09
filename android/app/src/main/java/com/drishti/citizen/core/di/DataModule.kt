package com.drishti.citizen.core.di

import android.content.Context
import androidx.room.Room
import com.drishti.citizen.core.cache.CachedResponseDao
import com.drishti.citizen.core.cache.DrishtiDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): DrishtiDatabase =
        Room.databaseBuilder(context, DrishtiDatabase::class.java, "drishti.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideCachedResponseDao(db: DrishtiDatabase): CachedResponseDao = db.cachedResponseDao()
}
