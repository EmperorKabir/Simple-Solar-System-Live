package com.livesolar.solarsystem

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews
import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.work.ListenableWorker
import androidx.work.WorkerParameters
import com.google.common.util.concurrent.ListenableFuture

class SolarSystemWidgetWorker(
    ctx: Context, params: WorkerParameters
) : ListenableWorker(ctx, params) {

    override fun startWork(): ListenableFuture<Result> = CallbackToFutureAdapter.getFuture { completer ->
        val appWidgetId = inputData.getInt("appWidgetId", -1)
        if (appWidgetId == -1) {
            completer.set(Result.failure())
            return@getFuture "no-id"
        }

        val mgr = AppWidgetManager.getInstance(applicationContext)
        val opts: Bundle = mgr.getAppWidgetOptions(appWidgetId)
        val density = applicationContext.resources.displayMetrics.density
        // Android publishes MIN/MAX width/height in different fields per orientation.
        // Portrait → MAX_WIDTH × MIN_HEIGHT; landscape → MIN_WIDTH × MAX_HEIGHT.
        val portrait = applicationContext.resources.configuration.orientation ==
            android.content.res.Configuration.ORIENTATION_PORTRAIT
        val widthDp = if (portrait)
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 320)
        else
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320)
        val heightDp = if (portrait)
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 320)
        else
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 320)
        // Clamp to 2048 px — RemoteViews bitmap cap above which IPC marshalling fails.
        val maxPx = 2048
        val widthPx = (widthDp * density).toInt().coerceIn(1, maxPx)
        val heightPx = (heightDp * density).toInt().coerceIn(1, maxPx)

        val params = SurfaceSettings(applicationContext, SurfaceSettings.widgetNamespace(appWidgetId))
            .urlParams("widget")

        Handler(Looper.getMainLooper()).post {
            WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params) { bitmap ->
                if (bitmap != null) {
                    try {
                        val rv = RemoteViews(applicationContext.packageName, R.layout.widget_initial)
                        rv.setImageViewBitmap(R.id.widget_image, bitmap)
                        val tapIntent = Intent(applicationContext, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        val pi = PendingIntent.getActivity(
                            applicationContext, appWidgetId, tapIntent,
                            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                        )
                        rv.setOnClickPendingIntent(R.id.widget_image, pi)
                        mgr.updateAppWidget(appWidgetId, rv)
                    } catch (_: Throwable) {
                        // best-effort; next periodic refresh will retry
                    }
                }
                completer.set(Result.success())
            }
        }
        "widget-render-$appWidgetId"
    }
}
