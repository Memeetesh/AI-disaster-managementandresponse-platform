package com.drishti.citizen.core.di

import com.drishti.citizen.core.auth.EncryptedTokenStore
import com.drishti.citizen.core.auth.TokenStore
import com.drishti.citizen.core.cache.ResponseCache
import com.drishti.citizen.core.cache.RoomResponseCache
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    @AppScope
    fun provideAppScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default)
}

@Module
@InstallIn(SingletonComponent::class)
abstract class AppBindingsModule {

    @Binds
    @Singleton
    abstract fun bindTokenStore(impl: EncryptedTokenStore): TokenStore

    @Binds
    @Singleton
    abstract fun bindResponseCache(impl: RoomResponseCache): ResponseCache
}
