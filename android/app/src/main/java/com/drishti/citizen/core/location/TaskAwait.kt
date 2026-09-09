package com.drishti.citizen.core.location

import com.google.android.gms.tasks.Task
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Awaits a Play Services [Task] without pulling in
 * `kotlinx-coroutines-play-services`. Resolves to the result (which may be
 * null), throws on failure, cancels the coroutine if the task is cancelled.
 */
suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { cont ->
    addOnSuccessListener { cont.resume(it) }
    addOnFailureListener { cont.resumeWithException(it) }
    addOnCanceledListener { cont.cancel() }
}
