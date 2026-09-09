package com.drishti.citizen.core.network

import com.drishti.citizen.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Evidence URLs from the API are origin-relative (`/uploads/image/….jpg`).
 * The web app strips `/api/v1` off `NEXT_PUBLIC_API_URL` to reach the static
 * mount; do the same to `BuildConfig.BASE_URL`.
 */
@Singleton
class MediaUrls @Inject constructor() {

    val origin: String = BuildConfig.BASE_URL.replace(Regex("/api/v1/?$"), "")

    fun resolve(path: String?): String? =
        path?.takeIf { it.isNotBlank() }?.let { if (it.startsWith("http")) it else origin + it }
}
