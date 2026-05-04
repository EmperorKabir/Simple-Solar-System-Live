package com.livesolar.solarsystem

import android.content.Context

/**
 * Per-surface user preferences (widget instance or live wallpaper).
 * Stored in distinct SharedPreferences files so widget and wallpaper
 * configs never collide. Used by the offscreen WebView renderer to
 * compose the URL params for index.html.
 */
class SurfaceSettings(context: Context, namespace: String) {
    private val prefs = context.getSharedPreferences("slss.$namespace", Context.MODE_PRIVATE)

    var offsetY: Float
        get() = prefs.getFloat("offsetY", DEFAULT_OFFSET_Y)
        set(value) = prefs.edit().putFloat("offsetY", value.coerceIn(0f, 0.7f)).apply()

    var labelsEnabled: Boolean
        get() = prefs.getBoolean("labels", true)
        set(value) = prefs.edit().putBoolean("labels", value).apply()

    /** URL params for index.html in widget/wallpaper mode. */
    fun urlParams(surface: String): String {
        val rounded = (offsetY * 10).toInt() / 10f
        val labels = if (labelsEnabled) "on" else "off"
        return "?surface=$surface&offsetY=$rounded&labels=$labels"
    }

    companion object {
        const val DEFAULT_OFFSET_Y = 0.0f
        fun widgetNamespace(appWidgetId: Int) = "widget_$appWidgetId"
        const val WALLPAPER_NAMESPACE = "wallpaper"

        /** Eight 10%-stepped values exposed in the settings UI. */
        val OFFSET_OPTIONS = floatArrayOf(0.0f, 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f)
        val OFFSET_LABELS = arrayOf("0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%")
    }
}
