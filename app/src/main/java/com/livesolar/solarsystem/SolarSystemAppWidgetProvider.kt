package com.livesolar.solarsystem

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class SolarSystemAppWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) scheduleWidget(context, id, runImmediately = true)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context, mgr: AppWidgetManager, appWidgetId: Int, newOptions: Bundle
    ) {
        scheduleWidget(context, appWidgetId, runImmediately = true)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val wm = WorkManager.getInstance(context)
        for (id in appWidgetIds) {
            wm.cancelUniqueWork("widget-refresh-$id")
            // Best-effort cleanup of stored settings.
            context.getSharedPreferences(
                "slss.${SurfaceSettings.widgetNamespace(id)}",
                Context.MODE_PRIVATE
            ).edit().clear().apply()
        }
    }

    companion object {
        fun scheduleWidget(context: Context, appWidgetId: Int, runImmediately: Boolean) {
            val data = Data.Builder().putInt("appWidgetId", appWidgetId).build()
            val periodic = PeriodicWorkRequestBuilder<SolarSystemWidgetWorker>(
                15, TimeUnit.MINUTES   // WorkManager's lower bound; closest practical match to 10 min spec
            ).setInputData(data).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "widget-refresh-$appWidgetId",
                ExistingPeriodicWorkPolicy.UPDATE,
                periodic
            )
            if (runImmediately) {
                // Mark the one-shot widget refresh as expedited so it bypasses
                // Samsung Freecess / Doze when the app is in the background
                // (e.g. just after a fold/unfold or settings change). Falls
                // back to a non-expedited request if the system's expedited
                // quota is exhausted, so we never lose the refresh entirely.
                //
                // enqueueUniqueWork(REPLACE) coalesces concurrent enqueues for
                // the same widget — a flurry of rapid-fire refresh triggers
                // (resize events, settings spam, etc.) collapses to a single
                // pending render instead of spawning N concurrent
                // VirtualDisplays, which OEM systems can refuse with a null
                // return that previously NPEd the process.
                val once = OneTimeWorkRequestBuilder<SolarSystemWidgetWorker>()
                    .setInputData(data)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .build()
                WorkManager.getInstance(context).enqueueUniqueWork(
                    "widget-refresh-once-$appWidgetId",
                    ExistingWorkPolicy.REPLACE,
                    once
                )
            }
        }
    }
}
