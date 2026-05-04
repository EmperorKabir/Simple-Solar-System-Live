package com.livesolar.solarsystem

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle

/**
 * Shown by Android when the user adds the widget to their home screen.
 * Saves chosen offsetY + labelsEnabled to the widget's namespaced
 * SharedPreferences, then triggers a render and finishes with RESULT_OK.
 */
class SolarSystemWidgetConfigActivity : SurfaceSettingsActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override val namespace: String
        get() = SurfaceSettings.widgetNamespace(appWidgetId)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Default to "cancelled" so if the user backs out, the widget is removed.
        setResult(Activity.RESULT_CANCELED)
        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish(); return
        }
        super.onCreate(savedInstanceState)
    }

    override fun onSaved(settings: SurfaceSettings) {
        SolarSystemAppWidgetProvider.scheduleWidget(this, appWidgetId, runImmediately = true)
        val out = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(Activity.RESULT_OK, out)
        finish()
    }
}
