package com.drishti.citizen.core.di

import javax.inject.Qualifier

/** Process-lifetime [kotlinx.coroutines.CoroutineScope] — outlives any screen. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AppScope
