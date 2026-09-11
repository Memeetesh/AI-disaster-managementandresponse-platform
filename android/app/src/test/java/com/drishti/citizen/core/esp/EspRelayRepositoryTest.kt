package com.drishti.citizen.core.esp

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class EspRelayRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repository: EspRelayRepository

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        repository = EspRelayRepository()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun gatewayAddress(): String = "${server.hostName}:${server.port}"

    @Test
    fun `posts the SOS fields and the bearer token, and reports success`() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"id":42,"status":"reported"}"""))

        val result = repository.sendSos(
            gatewayIp = gatewayAddress(),
            token = "citizen-jwt",
            latitude = 13.08,
            longitude = 80.27,
            peopleAffected = 1,
            description = "Emergency SOS",
        )

        assertTrue(result is EspRelayResult.Success)
        assertEquals(201, (result as EspRelayResult.Success).statusCode)

        val recorded = server.takeRequest()
        assertEquals("/relay", recorded.path)
        assertEquals("POST", recorded.method)
        assertEquals("Bearer citizen-jwt", recorded.getHeader("Authorization"))
        val body = recorded.body.readUtf8()
        assertTrue(body.contains("latitude=13.08"))
        assertTrue(body.contains("longitude=80.27"))
        assertTrue(body.contains("people_affected=1"))
    }

    @Test
    fun `a gateway error response surfaces its detail message`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(503)
                .setBody("""{"detail":"ESP32 gateway is not connected to the backend WiFi yet"}"""),
        )

        val result = repository.sendSos(
            gatewayIp = gatewayAddress(),
            token = "citizen-jwt",
            latitude = 13.08,
            longitude = 80.27,
            peopleAffected = 1,
            description = "Emergency SOS",
        )

        assertTrue(result is EspRelayResult.Failure)
        assertEquals(
            "ESP32 gateway is not connected to the backend WiFi yet",
            (result as EspRelayResult.Failure).message,
        )
    }

    @Test
    fun `an unreachable gateway is reported, not thrown`() = runTest {
        val unreachable = "127.0.0.1:1" // nothing listens here
        val result = repository.sendSos(
            gatewayIp = unreachable,
            token = null,
            latitude = 13.08,
            longitude = 80.27,
            peopleAffected = 1,
            description = "Emergency SOS",
        )

        assertTrue(result is EspRelayResult.Failure)
    }
}
