package com.drishti.citizen.core.media

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Minimal AAC/MP4 voice-note recorder for the report form. The web takes an
 * audio file upload; a native client records from the mic instead. One
 * recording at a time; files land in the app cache and are cleaned up on
 * [discard] / [cancel].
 */
@Singleton
class VoiceRecorder @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null

    val isRecording: Boolean get() = recorder != null

    /** @return true if recording actually started. */
    fun start(): Boolean {
        if (recorder != null) return false
        val file = File(context.cacheDir, "voice_note_${System.currentTimeMillis()}.m4a")
        val rec = newRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(96_000)
            setAudioSamplingRate(44_100)
            setOutputFile(file.absolutePath)
        }
        return try {
            rec.prepare()
            rec.start()
            recorder = rec
            outputFile = file
            true
        } catch (_: Exception) {
            runCatching { rec.release() }
            file.delete()
            false
        }
    }

    /** Stops and returns the recording, or null if it failed / was too short. */
    fun stop(): File? {
        val rec = recorder ?: return null
        recorder = null
        val file = outputFile
        outputFile = null
        return try {
            rec.stop()
            rec.release()
            file?.takeIf { it.exists() && it.length() > 0 }
        } catch (_: Exception) {
            runCatching { rec.release() }
            file?.delete()
            null
        }
    }

    /** Stop (if recording) and delete the file. */
    fun cancel() {
        stop()?.delete()
    }

    fun discard(file: File?) {
        file?.delete()
    }

    private fun newRecorder(): MediaRecorder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
}
