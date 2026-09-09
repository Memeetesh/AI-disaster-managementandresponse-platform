package com.drishti.citizen.core.media

import android.content.Context
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Turns a picked photo `Uri` / a recorded audio `File` into the multipart
 * parts `POST /reports` expects. The backend validates both the extension
 * and the `Content-Type` prefix (`backend/app/services/storage.py`), so the
 * filename here must carry a real extension.
 */
@Singleton
class MediaPartFactory @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    /** @throws java.io.IOException if the content can't be read. */
    fun imagePart(uri: Uri, field: String = "image"): MultipartBody.Part {
        val mime = context.contentResolver.getType(uri)?.lowercase(Locale.US) ?: "image/jpeg"
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: error("The selected image could not be opened")
        val body = bytes.toRequestBody(mime.toMediaTypeOrNull(), 0, bytes.size)
        return MultipartBody.Part.createFormData(field, "photo${imageExtension(mime)}", body)
    }

    fun audioPart(file: File, field: String = "audio"): MultipartBody.Part {
        val body = file.asRequestBody("audio/mp4".toMediaTypeOrNull())
        return MultipartBody.Part.createFormData(field, file.name, body)
    }

    companion object {
        /** Allowed image extensions per the backend's `ALLOWED_IMAGE_EXTENSIONS`. */
        fun imageExtension(mime: String?): String = when (mime?.lowercase(Locale.US)) {
            "image/png" -> ".png"
            "image/webp" -> ".webp"
            "image/gif" -> ".gif"
            else -> ".jpg" // image/jpeg and anything unexpected
        }
    }
}
