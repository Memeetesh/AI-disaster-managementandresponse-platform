package com.drishti.citizen.core.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * JWT storage backed by [EncryptedSharedPreferences] (AES-256). The web app
 * keeps its token in `localStorage`; a native client encrypts at rest.
 */
@Singleton
class EncryptedTokenStore @Inject constructor(
    @ApplicationContext private val context: Context,
) : TokenStore {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override fun peek(): String? = prefs.getString(KEY_TOKEN, null)

    override suspend fun save(token: String) = withContext(Dispatchers.IO) {
        prefs.edit().putString(KEY_TOKEN, token).commit()
        Unit
    }

    override suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit().remove(KEY_TOKEN).commit()
        Unit
    }

    private companion object {
        const val FILE_NAME = "drishti_secure_prefs"
        const val KEY_TOKEN = "jwt"
    }
}
