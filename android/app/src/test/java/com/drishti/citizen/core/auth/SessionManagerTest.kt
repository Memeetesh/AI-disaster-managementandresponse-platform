package com.drishti.citizen.core.auth

import com.drishti.citizen.data.model.UserRole
import com.drishti.citizen.data.remote.dto.AuthResponseDto
import com.drishti.citizen.data.remote.dto.UserDto
import com.drishti.citizen.testing.FakeApiService
import com.drishti.citizen.testing.FakeResponseCache
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Runs on [UnconfinedTestDispatcher] so the coroutines [SessionManager]
 * launches from its `init` block (token hydration, the forced-sign-out
 * collector) execute eagerly; `runTest` cancels `backgroundScope` when the
 * body returns.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SessionManagerTest {

    private val user = UserDto(
        id = 1,
        name = "Asha",
        phone = "9998887777",
        email = null,
        role = UserRole.CITIZEN,
        createdAt = "2026-09-01T10:00:00Z",
    )

    private class FakeTokenStore(initial: String? = null) : TokenStore {
        var token: String? = initial
            private set
        override fun peek(): String? = token
        override suspend fun save(token: String) { this.token = token }
        override suspend fun clear() { token = null }
    }

    private class MeApiService(private val meResult: () -> UserDto) : FakeApiService() {
        override suspend fun me(): UserDto = meResult()
    }

    private fun manager(
        scope: CoroutineScope,
        tokenStore: TokenStore,
        me: () -> UserDto = { user },
        events: SessionEvents = SessionEvents(),
    ) = SessionManager(MeApiService(me), tokenStore, FakeResponseCache(), events, scope)

    @Test
    fun `no stored token settles on SignedOut`() = runTest(UnconfinedTestDispatcher()) {
        val store = FakeTokenStore(initial = null)
        val sm = manager(backgroundScope, store)

        advanceUntilIdle()

        assertEquals(AuthState.SignedOut, sm.state.value)
    }

    @Test
    fun `stored token validated against auth me yields SignedIn`() = runTest(UnconfinedTestDispatcher()) {
        val store = FakeTokenStore(initial = "jwt-abc")
        val sm = manager(backgroundScope, store)

        advanceUntilIdle()

        val state = sm.state.value
        assertTrue(state is AuthState.SignedIn)
        assertEquals(1, (state as AuthState.SignedIn).user.id)
        assertEquals("jwt-abc", store.token)
    }

    @Test
    fun `stored token rejected by auth me is dropped`() = runTest(UnconfinedTestDispatcher()) {
        val store = FakeTokenStore(initial = "stale-jwt")
        val sm = manager(backgroundScope, store, me = { throw RuntimeException("401") })

        advanceUntilIdle()

        assertEquals(AuthState.SignedOut, sm.state.value)
        assertNull(store.token)
    }

    @Test
    fun `signIn persists the token and moves to SignedIn`() = runTest(UnconfinedTestDispatcher()) {
        val store = FakeTokenStore(initial = null)
        val sm = manager(backgroundScope, store)
        advanceUntilIdle()

        sm.signIn(AuthResponseDto(accessToken = "fresh-jwt", user = user))

        assertEquals("fresh-jwt", store.token)
        assertTrue(sm.state.value is AuthState.SignedIn)
    }

    @Test
    fun `signOut clears the token`() = runTest(UnconfinedTestDispatcher()) {
        val store = FakeTokenStore(initial = "jwt-abc")
        val sm = manager(backgroundScope, store)
        advanceUntilIdle()

        sm.signOut()

        assertEquals(AuthState.SignedOut, sm.state.value)
        assertNull(store.token)
    }

    @Test
    fun `a forced sign-out event clears the session`() = runTest(UnconfinedTestDispatcher()) {
        val store = FakeTokenStore(initial = "jwt-abc")
        val events = SessionEvents()
        val sm = manager(backgroundScope, store, events = events)
        advanceUntilIdle()
        assertTrue(sm.state.value is AuthState.SignedIn)

        events.notifyForcedSignOut()
        advanceUntilIdle()

        assertEquals(AuthState.SignedOut, sm.state.value)
        assertNull(store.token)
    }
}
