package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.safeApiCall
import com.drishti.citizen.data.remote.ApiService
import com.drishti.citizen.data.remote.dto.ChatMessageDto
import com.drishti.citizen.data.remote.dto.ChatRequest
import com.drishti.citizen.data.remote.dto.ChatResponseDto
import javax.inject.Inject

class ChatRepository @Inject constructor(
    private val api: ApiService,
) {
    /** Not cached — it's a live conversation. Send only the real turns (no local greeting). */
    suspend fun support(messages: List<ChatMessageDto>): ChatResponseDto =
        safeApiCall { api.supportChat(ChatRequest(messages)) }
}
