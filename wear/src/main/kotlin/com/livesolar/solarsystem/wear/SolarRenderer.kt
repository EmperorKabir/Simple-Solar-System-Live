package com.livesolar.solarsystem.wear

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.text.format.DateFormat
import android.view.SurfaceHolder
import androidx.wear.watchface.CanvasType
import androidx.wear.watchface.DrawMode
import androidx.wear.watchface.Renderer
import androidx.wear.watchface.WatchState
import androidx.wear.watchface.style.CurrentUserStyleRepository
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * MINIMAL first pass: draws a recognisable top-down solar system natively
 * (Sun + 8 orbit rings + moving planet dots) plus the time. This proves the
 * watch-face plumbing on the emulator; accurate positions (from the shared
 * orbital maths), tilt, labels, Pluto toggle, curved time/date and the
 * UserStyle settings are layered on next.
 */
class SolarRenderer(
    private val context: Context,
    surfaceHolder: SurfaceHolder,
    watchState: WatchState,
    currentUserStyleRepository: CurrentUserStyleRepository
) : Renderer.CanvasRenderer2<SolarRenderer.SolarAssets>(
    surfaceHolder,
    currentUserStyleRepository,
    watchState,
    CanvasType.HARDWARE,
    interactiveDrawModeUpdateDelayMillis = 60_000L,   // redraw ~once a minute (clock); planets move imperceptibly faster
    clearWithBackgroundTintBeforeRenderingHighlightLayer = false
) {

    class SolarAssets : Renderer.SharedAssets {
        override fun onDestroy() {}
    }

    override suspend fun createSharedAssets(): SolarAssets = SolarAssets()

    private val sunPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 204, 0) }
    private val orbitPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.5f
        color = Color.argb(70, 255, 255, 255)
    }
    private val planetPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val timePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(190, 255, 255, 255)
        textAlign = Paint.Align.CENTER
    }

    // Placeholder per-planet colours (Mercury..Neptune).
    private val planetColors = intArrayOf(
        0xFFB0B0B0.toInt(), 0xFFE6C27A.toInt(), 0xFF4A90D9.toInt(), 0xFFD9603B.toInt(),
        0xFFE0A766.toInt(), 0xFFD8C68A.toInt(), 0xFF9ED0DE.toInt(), 0xFF4A66D9.toInt()
    )

    override fun render(canvas: Canvas, bounds: Rect, zonedDateTime: ZonedDateTime, sharedAssets: SolarAssets) {
        val ambient = renderParameters.drawMode == DrawMode.AMBIENT
        canvas.drawColor(Color.BLACK)

        val cx = bounds.exactCenterX()
        val cy = bounds.exactCenterY()
        val maxR = min(bounds.width(), bounds.height()) / 2f - 6f

        // Sun
        sunPaint.color = if (ambient) Color.rgb(120, 120, 120) else Color.rgb(255, 204, 0)
        canvas.drawCircle(cx, cy, maxR * 0.06f, sunPaint)

        val n = 8
        for (i in 0 until n) {
            val r = maxR * (0.16f + 0.84f * (i + 1) / n)
            if (!ambient) canvas.drawCircle(cx, cy, r, orbitPaint)
            // Placeholder motion: angle from the epoch second, slower for outer orbits.
            val ang = (zonedDateTime.toEpochSecond() / (40.0 * (i + 1))) % (2 * Math.PI)
            val px = cx + (r * cos(ang)).toFloat()
            val py = cy + (r * sin(ang)).toFloat()
            planetPaint.color = if (ambient) Color.rgb(160, 160, 160) else planetColors[i % planetColors.size]
            canvas.drawCircle(px, py, maxR * 0.022f, planetPaint)
        }

        // Time near the bottom (flat for now; curved overlay comes with the settings step).
        timePaint.textSize = maxR * 0.17f
        timePaint.color = if (ambient) Color.argb(150, 200, 200, 200) else Color.argb(190, 255, 255, 255)
        val pattern = if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm"
        canvas.drawText(zonedDateTime.format(DateTimeFormatter.ofPattern(pattern)), cx, cy + maxR * 0.80f, timePaint)
    }

    override fun renderHighlightLayer(canvas: Canvas, bounds: Rect, zonedDateTime: ZonedDateTime, sharedAssets: SolarAssets) {
        // No editable highlights yet.
    }
}
