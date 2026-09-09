package com.drishti.citizen.data.model

/**
 * Static sample content for the Support tab. Lost & Found and Emotional
 * Support have no backend — the web ships them as sample data with a visible
 * disclaimer, and this mirrors that exactly. Do NOT wire these to an API.
 */
object SupportSamples {

    enum class LostFoundType(val label: String) {
        MISSING_PERSON("Missing Person"),
        FOUND_PERSON("Found Person"),
        BELONGING("Belonging"),
    }

    data class LostFoundItem(
        val id: String,
        val type: LostFoundType,
        val name: String,
        val description: String,
        val location: String,
        val date: String,
        val contact: String,
        val active: Boolean,
    )

    data class Exercise(val title: String, val description: String, val duration: String? = null)

    data class Helpline(val name: String, val number: String)

    val lostFound: List<LostFoundItem> = listOf(
        LostFoundItem(
            "1", LostFoundType.MISSING_PERSON, "Priya Sharma",
            "Female, 34 years, wearing a blue saree. Last seen near Rajpur Road market.",
            "Rajpur Road, Dehradun", "Sep 5, 2026", "+91 98765 11111", active = true,
        ),
        LostFoundItem(
            "2", LostFoundType.FOUND_PERSON, "Elderly Male (Unknown)",
            "Approximately 65 years, found near Garhi Cantt bus stop. Safe and receiving care.",
            "Garhi Cantt, Dehradun", "Sep 5, 2026", "+91 98765 22222", active = true,
        ),
        LostFoundItem(
            "3", LostFoundType.BELONGING, "Blue School Bag",
            "Found near the river bank. Contains books and a lunch box. Name tag reads \"Aarav\".",
            "Bankipur River Bank", "Sep 4, 2026", "+91 98765 33333", active = true,
        ),
        LostFoundItem(
            "4", LostFoundType.MISSING_PERSON, "Ramesh Verma",
            "Male, 45 years, last seen near the Doon Valley bridge. Wearing a white kurta.",
            "Doon Valley, Dehradun", "Sep 3, 2026", "+91 98765 44444", active = false,
        ),
    )

    fun lostFound(filter: LostFoundType?): List<LostFoundItem> =
        if (filter == null) lostFound else lostFound.filter { it.type == filter }

    val breathing: List<Exercise> = listOf(
        Exercise("4-7-8 Breathing", "Inhale for 4 seconds, hold for 7, exhale for 8", "5 min"),
        Exercise("Box Breathing", "Equal inhale, hold, exhale, and hold", "4 min"),
        Exercise("Calm Breath", "Slow, deep belly breathing for relaxation", "6 min"),
    )

    val grounding: List<Exercise> = listOf(
        Exercise("5-4-3-2-1 Grounding", "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste"),
        Exercise("Body Scan", "Slowly bring attention to each part of your body from head to toe"),
        Exercise("Safe Place Visualization", "Picture a calm, safe place in vivid detail"),
    )

    val helplines: List<Helpline> = listOf(
        Helpline("iCall Mental Health", "9152987821"),
        Helpline("Vandrevala Foundation", "18602662345"),
    )

    const val SAATHI_GREETING =
        "Hi, I'm Saathi. I'm here to listen — no rush. How are you feeling right now?"

    const val SAATHI_CRISIS_FALLBACK =
        "I'm having trouble responding right now. If this feels urgent, please call 112, " +
            "iCall on 9152987821, or the Vandrevala Foundation on 1860-2662-345."
}
