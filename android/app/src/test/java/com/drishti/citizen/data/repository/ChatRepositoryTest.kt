package com.drishti.citizen.data.repository

import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.data.remote.dto.ChatMessageDto
import com.drishti.citizen.data.remote.dto.ChatRequest
import com.drishti.citizen.data.remote.dto.ChatResponseDto
import com.drishti.citizen.testing.FakeApiService
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class ChatRepositoryTest {

    @Test
    fun `support returns the model reply`() = runTest {
        val api = object : FakeApiService() {
            override suspend fun supportChat(body: ChatRequest): ChatResponseDto {
                assertEquals(1, body.messages.size)
                return ChatResponseDto(reply = "I hear you. Take a slow breath.", source = "fallback")
            }
        }
        val response = ChatRepository(api).support(listOf(ChatMessageDto("user", "I'm scared")))
        assertEquals("I hear you. Take a slow breath.", response.reply)
    }

    @Test
    fun `a transport failure surfaces as ApiError`() = runTest {
        val api = object : FakeApiService() {
            override suspend fun supportChat(body: ChatRequest): ChatResponseDto = throw IOException("down")
        }
        val error = runCatching {
            ChatRepository(api).support(listOf(ChatMessageDto("user", "hi")))
        }.exceptionOrNull()
        assertTrue(error is ApiError)
        assertEquals(0, (error as ApiError).status)
    }
}
