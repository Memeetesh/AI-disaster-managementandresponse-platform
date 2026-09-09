package com.drishti.citizen.data.remote

import com.drishti.citizen.core.network.ApiError
import com.drishti.citizen.core.network.safeApiCall
import com.drishti.citizen.data.model.UserRole
import com.drishti.citizen.data.remote.dto.LoginRequest
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.create

@OptIn(ExperimentalSerializationApi::class)
class ApiServiceTest {

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
        api = Retrofit.Builder()
            .baseUrl(server.url("/api/v1/"))
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `me deserializes the user payload`() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """
                {"id":7,"name":"Asha","phone":"9998887777","email":null,
                 "role":"citizen","created_at":"2026-09-01T10:00:00Z"}
                """.trimIndent(),
            ),
        )

        val user = api.me()

        assertEquals(7, user.id)
        assertEquals("Asha", user.name)
        assertEquals(UserRole.CITIZEN, user.role)

        val recorded = server.takeRequest()
        assertEquals("/api/v1/auth/me", recorded.path)
    }

    @Test
    fun `login posts phone and password and parses the token`() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """
                {"access_token":"jwt-123","token_type":"bearer",
                 "user":{"id":1,"name":"Asha","phone":"9998887777","email":null,
                         "role":"citizen","created_at":"2026-09-01T10:00:00Z"}}
                """.trimIndent(),
            ),
        )

        val auth = api.login(LoginRequest(phone = "9998887777", password = "hunter2xx"))

        assertEquals("jwt-123", auth.accessToken)
        assertEquals(1, auth.user.id)

        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals("/api/v1/auth/login", recorded.path)
        val sentBody = recorded.body.readUtf8()
        assert(sentBody.contains("\"phone\":\"9998887777\"")) { "phone missing from $sentBody" }
        assert(sentBody.contains("\"password\":\"hunter2xx\"")) { "password missing from $sentBody" }
    }

    @Test
    fun `safeApiCall maps a string-detail 401 to ApiError`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(401)
                .setBody("""{"detail":"Invalid phone or password"}"""),
        )

        val error = runCatching {
            safeApiCall { api.login(LoginRequest("9998887777", "wrongpass")) }
        }.exceptionOrNull()

        assertNotNull(error)
        assertEquals(401, (error as ApiError).status)
        assertEquals("Invalid phone or password", error.message)
    }

    @Test
    fun `safeApiCall maps a 422 validation array to the first msg`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(422).setBody(
                """{"detail":[{"msg":"String should have at least 8 characters","loc":["body","password"]}]}""",
            ),
        )

        val error = runCatching {
            safeApiCall { api.login(LoginRequest("9998887777", "short")) }
        }.exceptionOrNull()

        assertNotNull(error)
        assertEquals(422, (error as ApiError).status)
        assertEquals("String should have at least 8 characters", error.message)
    }
}
