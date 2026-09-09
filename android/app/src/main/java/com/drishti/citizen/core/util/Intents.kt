package com.drishti.citizen.core.util

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Opens the dialer with [number] pre-filled (digits and `+` only). */
fun dialNumber(context: Context, number: String) {
    val clean = number.filter { it.isDigit() || it == '+' }
    runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$clean"))) }
}

/**
 * Opens a map at the given point, labelled [label]. Prefers a `geo:` intent
 * (any installed map app); falls back to OpenStreetMap in the browser.
 */
fun openLocationOnMap(context: Context, latitude: Double, longitude: Double, label: String) {
    val geo = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("geo:$latitude,$longitude?q=$latitude,$longitude(${Uri.encode(label)})"),
    )
    runCatching { context.startActivity(geo) }.onFailure {
        runCatching {
            context.startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(
                        "https://www.openstreetmap.org/?mlat=$latitude&mlon=$longitude" +
                            "#map=16/$latitude/$longitude",
                    ),
                ),
            )
        }
    }
}
