package com.drishti.citizen.core.network

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiErrorParserTest {

    @Test
    fun `string detail is returned verbatim`() {
        val message = ApiErrorParser.messageFrom("""{"detail":"Invalid phone or password"}""")
        assertEquals("Invalid phone or password", message)
    }

    @Test
    fun `validation-error array yields the first msg`() {
        val body = """
            {"detail":[
              {"msg":"String should have at least 8 characters","loc":["body","password"]},
              {"msg":"field required","loc":["body","name"]}
            ]}
        """.trimIndent()
        assertEquals("String should have at least 8 characters", ApiErrorParser.messageFrom(body))
    }

    @Test
    fun `blank or null body falls back to the generic message`() {
        assertEquals(ApiError.GENERIC_MESSAGE, ApiErrorParser.messageFrom(null))
        assertEquals(ApiError.GENERIC_MESSAGE, ApiErrorParser.messageFrom("   "))
    }

    @Test
    fun `non-JSON body falls back to the generic message`() {
        assertEquals(ApiError.GENERIC_MESSAGE, ApiErrorParser.messageFrom("<html>502 Bad Gateway</html>"))
    }

    @Test
    fun `object without a detail key falls back to the generic message`() {
        assertEquals(ApiError.GENERIC_MESSAGE, ApiErrorParser.messageFrom("""{"error":"nope"}"""))
    }
}
