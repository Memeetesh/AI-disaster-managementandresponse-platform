package com.drishti.citizen.data.remote.dto

import kotlinx.serialization.Serializable

/** `POST /chat/support` — the "Talk to Saathi" companion (`backend/app/schemas/chat.py`). */
@Serializable
data class ChatMessageDto(
    val role: String, // user | assistant
    val content: String,
)

@Serializable
data class ChatRequest(val messages: List<ChatMessageDto>)

@Serializable
data class ChatResponseDto(
    val reply: String,
    val source: String, // llm | fallback | error
)
