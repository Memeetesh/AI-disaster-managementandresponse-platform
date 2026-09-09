package com.drishti.citizen.core.media

import org.junit.Assert.assertEquals
import org.junit.Test

class MediaPartFactoryTest {

    @Test
    fun `image extension maps to what the backend allows`() {
        assertEquals(".png", MediaPartFactory.imageExtension("image/png"))
        assertEquals(".webp", MediaPartFactory.imageExtension("image/webp"))
        assertEquals(".gif", MediaPartFactory.imageExtension("image/gif"))
        assertEquals(".jpg", MediaPartFactory.imageExtension("image/jpeg"))
        assertEquals(".jpg", MediaPartFactory.imageExtension("IMAGE/JPEG"))
        assertEquals(".jpg", MediaPartFactory.imageExtension(null))
        assertEquals(".jpg", MediaPartFactory.imageExtension("application/octet-stream"))
    }
}
