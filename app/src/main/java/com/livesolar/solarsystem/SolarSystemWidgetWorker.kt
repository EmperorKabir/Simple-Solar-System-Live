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
// SLSS_DIAG_TEMPORARY — widget render diagnostics.
import com.livesolar.solarsystem.diag.SlssLogger
import com.livesolar.solarsystem.diag.SlssCentroidProbe
import com.livesolar.solarsystem.diag.SlssMetrics

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

        // SLSS_DIAG_TEMPORARY — widget_render{worker_start} with the full
        // options bundle, including OPTION_APPWIDGET_SIZES (the One UI size
        // list, relevant to the L/R framing asymmetry).
        val corr = SlssLogger.newCorrelationId()
        if (SlssLogger.enabled) {
            SlssLogger.logEvent(
                "widget_render",
                mapOf(
                    "stage" to "worker_start",
                    "surface" to "widget",
                    "widget_id" to appWidgetId,
                    "options_bundle" to slssOptionsBundle(opts),
                    "display" to mapOf(
                        "orientation" to if (portrait) "portrait" else "landscape",
                        "density" to density,
                        "screen_width_px" to applicationContext.resources.displayMetrics.widthPixels,
                        "screen_height_px" to applicationContext.resources.displayMetrics.heightPixels
                    ),
                    "requested_dims_px" to mapOf("w" to widthPx, "h" to heightPx),
                    "css_aspect" to widthPx.toDouble() / heightPx,
                    "url_params" to params
                ),
                correlationId = corr
            )
            SlssMetrics.snapshotMemoryAsync("pre_widget_render")
        }

        Handler(Looper.getMainLooper()).post {
            WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params, "widget", corr) { bitmap ->
                if (SlssLogger.enabled) {
                    val centroid = SlssCentroidProbe.measure(bitmap)
                    SlssLogger.logEvent(
                        "widget_render",
                        mapOf(
                            "stage" to "post_compose_centroid",
                            "surface" to "widget",
                            "widget_id" to appWidgetId,
                            "bitmap_null" to (bitmap == null),
                            "post_compose_centroid" to centroid?.toMap()
                        ),
                        correlationId = corr
                    )
                    SlssMetrics.snapshotMemoryAsync("post_widget_render")
                }
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

    // SLSS_DIAG_TEMPORARY — snapshot the full AppWidget options bundle for the
    // widget render diagnostics. OPTION_APPWIDGET_SIZES (API 31+) is the list
    // of SizeF the launcher actually offers.
    private fun slssOptionsBundle(opts: Bundle): Map<String, Any?> {
        val sizes: List<Map<String, Any?>>? = try {
            @Suppress("DEPRECATION")
            val list = opts.getParcelableArrayList<android.util.SizeF>(
                AppWidgetManager.OPTION_APPWIDGET_SIZES
            )
            list?.map { mapOf("w" to it.width, "h" to it.height) }
        } catch (_: Throwable) {
            null
        }
        return mapOf(
            "MIN_WIDTH_dp" to opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, -1),
            "MAX_WIDTH_dp" to opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, -1),
            "MIN_HEIGHT_dp" to opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, -1),
            "MAX_HEIGHT_dp" to opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, -1),
            "CATEGORY" to opts.getInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY, -1),
            "SIZES_list_sizef" to sizes
        )
    }
}
