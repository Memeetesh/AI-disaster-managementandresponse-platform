package com.drishti.citizen.data.model

/** The `type` options on the report form — mirrors `INCIDENT_TYPES` on the web. */
enum class IncidentType(val wire: String, val label: String) {
    FLOOD("flood", "Flood"),
    FIRE("fire", "Fire"),
    EARTHQUAKE("earthquake", "Earthquake"),
    CYCLONE("cyclone", "Cyclone"),
    LANDSLIDE("landslide", "Landslide"),
    OTHER("other", "Other"),
}
