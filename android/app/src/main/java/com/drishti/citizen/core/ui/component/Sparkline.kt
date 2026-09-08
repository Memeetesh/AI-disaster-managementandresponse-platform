package com.drishti.citizen.core.ui.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/**
 * Minimal trend sparkline — the equivalent of the web app's `<LineChart>` for
 * the tiny `trend: number[]` arrays the forecast endpoints return.
 */
@Composable
fun Sparkline(
    data: List<Float>,
    modifier: Modifier = Modifier,
    color: Color = Color(0xFF1B2F52),
    fill: Boolean = false,
) {
    if (data.size < 2) {
        Spacer(modifier)
        return
    }
    Canvas(modifier) {
        val min = data.minOrNull() ?: 0f
        val max = data.maxOrNull() ?: 0f
        val range = (max - min).takeIf { it != 0f } ?: 1f
        val stepX = size.width / (data.size - 1)

        val points = data.mapIndexed { i, v ->
            Offset(
                x = i * stepX,
                y = size.height - ((v - min) / range) * size.height,
            )
        }

        val line = Path().apply {
            moveTo(points.first().x, points.first().y)
            points.drop(1).forEach { lineTo(it.x, it.y) }
        }

        if (fill) {
            val area = Path().apply {
                addPath(line)
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            drawPath(area, color.copy(alpha = 0.12f))
        }

        drawPath(
            path = line,
            color = color,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round),
        )
    }
}
