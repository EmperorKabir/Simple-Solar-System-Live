package com.livesolar.solarsystem

import android.content.Context

/**
 * Per-surface user preferences (widget instance, home wallpaper, or lock
 * wallpaper). Stored in distinct SharedPreferences files so configurations
 * for different surfaces never collide. Used by the offscreen WebView
 * renderer to compose the URL params for index.html.
 */
class SurfaceSettings(
    context: Context,
    namespace: String,
    private val defaultOffsetY: Float = 0f
) {
    private val prefs = context.getSharedPreferences("slss.$namespace", Context.MODE_PRIVATE)

    var offsetY: Float
        get() = prefs.getFloat("offsetY", defaultOffsetY)
        set(value) = prefs.edit().putFloat("offsetY", value.coerceIn(0f, 0.7f)).apply()

    var tilt: Float
        get() = prefs.getFloat("tilt", DEFAULT_TILT)
        set(value) = prefs.edit().putFloat("tilt", value.coerceIn(0f, 1.0f)).apply()

    var labelsEnabled: Boolean
        get() = prefs.getBoolean("labels", true)
        set(value) = prefs.edit().putBoolean("labels", value).apply()

    var hidePluto: Boolean
        get() = prefs.getBoolean("hidePluto", DEFAULT_HIDE_PLUTO)
        set(value) = prefs.edit().putBoolean("hidePluto", value).apply()

    /** URL params for index.html in widget/wallpaper mode. */
    fun urlParams(surface: String): String {
        val offset = (offsetY * 10).toInt() / 10f
        val tiltR  = (tilt    * 10).toInt() / 10f
        val labels = if (labelsEnabled) "on" else "off"
        val pluto  = if (hidePluto) "off" else "on"
        return "?surface=$surface&offsetY=$offset&tilt=$tiltR&labels=$labels&pluto=$pluto"
    }

    companion object {
        fun widgetNamespace(appWidgetId: Int) = "widget_$appWidgetId"
        const val HOME_WALLPAPER_NAMESPACE = "wallpaper_home"
        const val LOCK_WALLPAPER_NAMESPACE = "wallpaper_lock"
        const val DEFAULT_HOME_OFFSET_Y = 0.0f
        const val DEFAULT_LOCK_OFFSET_Y = 0.3f
        const val DEFAULT_TILT = 0.0f
        const val DEFAULT_HIDE_PLUTO = false

        /** Eight 10%-stepped values exposed in the picker UI. */
        val OFFSET_OPTIONS = floatArrayOf(0.0f, 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f)
        val OFFSET_LABELS = arrayOf("0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%")

        /** Tilt: 0 % = top-down (camera at +Y), 100 % = side-on (90° pitch, camera in equatorial plane). */
        val TILT_OPTIONS = floatArrayOf(0.0f, 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f, 0.8f, 0.9f, 1.0f)
        val TILT_LABELS  = arrayOf("0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%")
    }
}
