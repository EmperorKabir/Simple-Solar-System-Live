package com.livesolar.solarsystem

import android.app.Presentation
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import com.livesolar.solarsystem.BuildConfig
// SLSS_DIAG_TEMPORARY — render-pipeline diagnostic logging.
import com.livesolar.solarsystem.diag.SlssLogger
import com.livesolar.solarsystem.diag.SlssLoggerJsBridge

/**
 * Offscreen WebView → Bitmap renderer for the home-screen widget and live
 * wallpapers.
 *
 * Why the Presentation+VirtualDisplay path: a plain `new WebView(ctx)` outside
 * any window cannot host WebGL (returns an all-black bitmap). The WebView
 * needs a real Window context, which a Presentation on a VirtualDisplay
 * backed by an ImageReader surface provides.
 *
 * Why native compositing: `ctx.drawImage(WebGLcanvas, ...)` to a JS 2D canvas
 * silently produces a black bitmap inside this Presentation context, so we
 * export the raw WebGL canvas PNG plus a JSON of label positions and composite
 * the final Bitmap (offset region + scene + labels) via android.graphics.Canvas.
 *
 * Must be invoked on the main looper.
 */
object WebViewBitmapRenderer {
    private const val TAG = "SolarRenderer"
    private const val OVERALL_TIMEOUT_MS = 12000L

    // SLSS perf (C1) — bitmap compose (JSON parse + Base64 + multi-MP PNG decode +
    // Canvas draw) runs OFF the main looper on this single background thread so it
    // never janks the foreground app (the whole app shares one main thread). Single-
    // threaded: composes serialise (≤2 in flight via the gate) and we avoid idle pool
    // threads for a render that fires every 10–15 min. cleanup() + onResult still hop
    // back to MAIN (WebView.destroy + gate bookkeeping are main-thread-only).
    private val composeExecutor = Executors.newSingleThreadExecutor()

    // Process-global concurrency gate. Each render holds a live WebGL context
    // (>1GB peak at inner-display sizes). A fold/unfold animation fires a
    // CASCADE of size changes; without a cap the widget + wallpaper pipelines
    // spawn 5+ simultaneous contexts, overflowing Chromium's process-wide
    // context pool — the browser then evicts the OLDEST context ("Too many
    // active WebGL contexts. Oldest context will be lost." → "Context Lost."),
    // which is what blanks a render's scene and yields the "labels but no
    // planets/orbital rings" frame. Capping concurrent renders keeps the pool
    // (and peak memory) within budget. All access is on the main looper, so no
    // locking is needed.
    private const val MAX_CONCURRENT_RENDERS = 2
    private var activeRenders = 0
    private class PendingRender(
        val context: Context,
        val widthPx: Int,
        val heightPx: Int,
        val urlParams: String,
        val surfaceKind: String,
        val correlationId: String?,
        val onResult: (Bitmap?) -> Unit
    )
    private val pendingRenders = ArrayDeque<PendingRender>()

    /**
     * Public entry: queue a render behind the concurrency gate. A fold's
     * intermediate animation sizes are superseded — a newer request for the
     * same surfaceKind drops any still-queued one (its caller gets null, i.e.
     * "keep your previous bitmap"), so only the latest size actually renders.
     */
    fun render(
        context: Context,
        widthPx: Int,
        heightPx: Int,
        urlParams: String,
        // SLSS_DIAG_TEMPORARY params (defaulted so non-diagnostic callers are
        // unaffected). surfaceKind drives the event type (widget_render vs
        // wallpaper_render); correlationId ties the worker/engine span to the
        // render-pipeline stages and to the JS framing diagnostics.
        surfaceKind: String = "widget",
        correlationId: String? = null,
        onResult: (Bitmap?) -> Unit
    ) {
        require(Looper.myLooper() == Looper.getMainLooper()) {
            "WebViewBitmapRenderer.render must be called on the main thread"
        }
        if (widthPx <= 0 || heightPx <= 0) { onResult(null); return }
        // Collapse superseded same-surface requests still waiting in the queue.
        val it = pendingRenders.iterator()
        while (it.hasNext()) {
            val p = it.next()
            if (p.surfaceKind == surfaceKind) { it.remove(); p.onResult(null) }
        }
        pendingRenders.addLast(
            PendingRender(context, widthPx, heightPx, urlParams, surfaceKind, correlationId, onResult)
        )
        pumpRenderQueue()
    }

    private fun pumpRenderQueue() {
        while (activeRenders < MAX_CONCURRENT_RENDERS && pendingRenders.isNotEmpty()) {
            val p = pendingRenders.removeFirst()
            activeRenders++
            runRender(p.context, p.widthPx, p.heightPx, p.urlParams, p.surfaceKind, p.correlationId) { bm ->
                activeRenders--
                try { p.onResult(bm) } finally { pumpRenderQueue() }
            }
        }
    }

    private fun runRender(
        context: Context,
        widthPx: Int,
        heightPx: Int,
        urlParams: String,
        surfaceKind: String,
        correlationId: String?,
        onResult: (Bitmap?) -> Unit
    ) {
        val app = context.applicationContext
        val handler = Handler(Looper.getMainLooper())
        // B1 — atomic first-wins across the JS-bridge thread (snapshot/error) and the
        // main-thread timeout. A non-atomic var let two resolutions both pass the
        // guard and double-decrement activeRenders, corrupting the gate.
        val done = AtomicBoolean(false)
        val tStart = android.os.SystemClock.elapsedRealtime()
        Log.i(TAG, "DIAG render start ${widthPx}x${heightPx} surface=${urlParams}")

        // SLSS_DIAG_TEMPORARY — render-pipeline stage logging.
        val slssEvt = if (surfaceKind.startsWith("widget")) "widget_render" else "wallpaper_render"
        if (SlssLogger.enabled) {
            SlssLogger.logEvent(
                slssEvt,
                mapOf(
                    "stage" to "renderer_construct",
                    "surface" to surfaceKind,
                    "requested_dims_px" to mapOf("w" to widthPx, "h" to heightPx),
                    "css_aspect" to widthPx.toDouble() / heightPx,
                    "url_params" to urlParams
                ),
                correlationId = correlationId
            )
        }

        val imageReader = ImageReader.newInstance(widthPx, heightPx, PixelFormat.RGBA_8888, 2)
        val displayManager = app.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val density = app.resources.displayMetrics.densityDpi
        // createVirtualDisplay returns null when the system is out of resources
        // (concurrent VD count limit, surface flinger pressure, OEM throttling).
        // A NullPointerException here would crash the process and loop, since
        // the failed widget worker re-fires WorkManager jobs on restart. Treat
        // as recoverable: log, clean up, return a null bitmap so the launcher
        // keeps the previous cached bitmap instead of force-closing.
        val virtualDisplay: VirtualDisplay? = displayManager.createVirtualDisplay(
            "SolarRenderer-${System.nanoTime()}",
            widthPx, heightPx, density,
            imageReader.surface,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY
        )
        if (virtualDisplay == null) {
            Log.w(TAG, "createVirtualDisplay returned null — system out of resources, skipping render")
            try { imageReader.close() } catch (_: Throwable) {}
            onResult(null); return
        }

        val presentation = try {
            val p = Presentation(app, virtualDisplay.display)
            p.window?.setBackgroundDrawableResource(android.R.color.black)
            p
        } catch (t: Throwable) {
            Log.w(TAG, "presentation create failed", t)
            try { virtualDisplay.release() } catch (_: Throwable) {}
            try { imageReader.close() } catch (_: Throwable) {}
            onResult(null); return
        }

        // Held so cleanup() can destroy it. The offscreen WebView MUST be
        // destroyed or its WebGL context leaks into Chromium's process-global
        // pool (~16 max). After enough renders the pool overflows and Chromium
        // evicts the OLDEST live context — frequently the in-app preview's —
        // blanking it ("Too many active WebGL contexts. Oldest context will be
        // lost." → "Context Lost."). dismiss()/release()/close() alone do NOT
        // free the WebView's GL context; only WebView.destroy() does.
        var renderWebView: WebView? = null
        val cleanup: () -> Unit = {
            try {
                renderWebView?.let { w ->
                    try { w.stopLoading() } catch (_: Throwable) {}
                    (w.parent as? ViewGroup)?.removeView(w)
                    w.loadUrl("about:blank")
                    w.destroy()
                }
            } catch (_: Throwable) {}
            renderWebView = null
            try { presentation.dismiss() } catch (_: Throwable) {}
            try { virtualDisplay.release() } catch (_: Throwable) {}
            try { imageReader.close() } catch (_: Throwable) {}
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(app))
            .build()

        // B1 — named so snapshot/error resolution can cancel it; otherwise a resolved
        // render holds this delayed lambda + its captures for the full 12 s timeout.
        val timeoutRunnable = Runnable {
            if (!done.compareAndSet(false, true)) return@Runnable
            Log.w(TAG, "render timeout — JS bridge never fired")
            cleanup(); onResult(null)
        }

        val bridge = SnapshotBridge(onSnapshotJson = { json ->
            if (!done.compareAndSet(false, true)) return@SnapshotBridge
            handler.removeCallbacks(timeoutRunnable)
            val tSnap = android.os.SystemClock.elapsedRealtime()
            Log.i(TAG, "DIAG snapshot received t=${tSnap - tStart}ms chars=${json.length}")
            if (SlssLogger.enabled) {
                SlssLogger.logEvent(
                    slssEvt,
                    mapOf(
                        "stage" to "js_snapshot_ready",
                        "surface" to surfaceKind,
                        "snapshot_chars" to json.length,
                        "ms_since_start" to (tSnap - tStart)
                    ),
                    correlationId = correlationId
                )
            }
            // C1 — compose on the background executor (heavy: JSON+Base64+PNG decode+
            // Canvas), then hop to MAIN for cleanup()+onResult so WebView.destroy and
            // the gate bookkeeping stay main-thread. try/finally guarantees
            // cleanup+onResult(null) even if compose throws.
            composeExecutor.execute {
                var bm: Bitmap? = null
                try {
                    bm = composeBitmap(json, widthPx, heightPx, app, urlParams, surfaceKind, correlationId)
                } catch (t: Throwable) {
                    Log.w(TAG, "compose failed", t)
                } finally {
                    handler.post {
                        cleanup()
                        Log.i(TAG, "DIAG bitmap done t=${android.os.SystemClock.elapsedRealtime() - tStart}ms")
                        if (SlssLogger.enabled) {
                            SlssLogger.logEvent(
                                slssEvt,
                                mapOf(
                                    "stage" to "callback_returned",
                                    "surface" to surfaceKind,
                                    "bitmap_null" to (bm == null),
                                    "total_ms" to (android.os.SystemClock.elapsedRealtime() - tStart)
                                ),
                                correlationId = correlationId
                            )
                        }
                        onResult(bm)
                    }
                }
            }
        }, onSnapshotError = { msg ->
            // JS refused to emit a frame (e.g. WebGL context lost under the
            // concurrent-render memory pressure of a fold burst). Resolve null
            // NOW instead of waiting out OVERALL_TIMEOUT_MS — the engine keeps
            // the previous good bitmap and schedules a retry, so the surface
            // never shows the blank-scene ("labels but no planets") frame.
            if (!done.compareAndSet(false, true)) return@SnapshotBridge
            handler.removeCallbacks(timeoutRunnable)
            Log.w(TAG, "DIAG snapshot error: $msg — returning null")
            if (SlssLogger.enabled) {
                SlssLogger.logEvent(
                    slssEvt,
                    mapOf(
                        "stage" to "js_snapshot_error",
                        "surface" to surfaceKind,
                        "error" to msg,
                        "ms_since_start" to (android.os.SystemClock.elapsedRealtime() - tStart)
                    ),
                    correlationId = correlationId
                )
            }
            handler.post { cleanup(); onResult(null) }
        })

        val wv = WebView(app)
        renderWebView = wv
        wv.layoutParams = ViewGroup.LayoutParams(widthPx, heightPx)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.settings.useWideViewPort = false
        wv.settings.loadWithOverviewMode = false
        wv.setBackgroundColor(Color.BLACK)
        wv.addJavascriptInterface(bridge, "SnapshotBridge")
        // SLSS_DIAG_TEMPORARY — expose the diagnostic bridge to the offscreen
        // render WebView so calcResetView's per-planet framing diagnostics
        // (the widget L/R asymmetry data) reach the logger.
        if (SlssLogger.enabled) {
            wv.addJavascriptInterface(SlssLoggerJsBridge("WebViewBitmapRenderer-$surfaceKind"), "SlssLog")
        }
        // SLSS_DIAG_TEMPORARY — forward the offscreen render WebView's JS console
        // (the widget/wallpaper render can't be DevTools-inspected) to the log.
        wv.webChromeClient = if (SlssLogger.enabled) {
            object : WebChromeClient() {
                override fun onConsoleMessage(cm: android.webkit.ConsoleMessage): Boolean {
                    SlssLogger.logEvent(
                        "webview_console",
                        mapOf(
                            "webview_owner" to "WebViewBitmapRenderer-$surfaceKind",
                            "level" to cm.messageLevel().name,
                            "source_id" to cm.sourceId(),
                            "line_number" to cm.lineNumber(),
                            "message" to cm.message()
                        ),
                        correlationId = correlationId
                    )
                    return false
                }
            }
        } else {
            WebChromeClient()
        }
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
        }
        presentation.setContentView(wv)
        try { presentation.show() } catch (t: Throwable) {
            Log.w(TAG, "presentation.show failed", t)
            cleanup(); onResult(null); return
        }

        handler.postDelayed(timeoutRunnable, OVERALL_TIMEOUT_MS)

        // SLSS_DIAG_TEMPORARY — pass the correlation id into JS so calcResetView
        // can tag its framing diagnostics with the same span id.
        val finalUrl = "https://appassets.androidplatform.net/assets/index.html$urlParams" +
            if (SlssLogger.enabled && correlationId != null) "&slssCorr=$correlationId" else ""
        wv.loadUrl(finalUrl)
    }

    private fun composeBitmap(
        metaJson: String,
        requestedW: Int,
        requestedH: Int,
        diagContext: Context? = null,
        diagTag: String = "",
        surfaceKind: String = "widget",
        correlationId: String? = null
    ): Bitmap? {
        val meta = JSONObject(metaJson)
        val sceneDataUrl = meta.getString("sceneDataUrl")
        val sceneBitmap = decodeDataUrl(sceneDataUrl) ?: return null

        val out = Bitmap.createBitmap(requestedW, requestedH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        canvas.drawColor(Color.BLACK)

        val offsetY = meta.optDouble("offsetY", 0.0).toFloat()
        val offsetTopPxOut = (requestedH * offsetY).toInt()
        val targetH = requestedH - offsetTopPxOut

        val sceneAspect = sceneBitmap.width.toFloat() / sceneBitmap.height.toFloat()
        val drawW = requestedW
        val drawH = (drawW / sceneAspect).toInt().coerceAtMost(targetH)
        val drawTop = offsetTopPxOut + (targetH - drawH) / 2
        val srcRect = android.graphics.Rect(0, 0, sceneBitmap.width, sceneBitmap.height)
        val dstRect = android.graphics.Rect(0, drawTop, drawW, drawTop + drawH)
        // SLSS_DIAG_TEMPORARY — record the compose-rect maths BEFORE recycling.
        val sceneW = sceneBitmap.width
        val sceneH = sceneBitmap.height
        canvas.drawBitmap(sceneBitmap, srcRect, dstRect, Paint(Paint.FILTER_BITMAP_FLAG))
        sceneBitmap.recycle()

        if (SlssLogger.enabled) {
            val evt = if (surfaceKind.startsWith("widget")) "widget_render" else "wallpaper_render"
            SlssLogger.logEvent(
                evt,
                mapOf(
                    "stage" to "compose_done",
                    "surface" to surfaceKind,
                    "scene_bitmap_dims_px" to mapOf("w" to sceneW, "h" to sceneH),
                    "scene_aspect" to sceneAspect,
                    "compose_meta" to mapOf(
                        "offsetY_meta" to offsetY,
                        "offset_top_px" to offsetTopPxOut,
                        "target_h" to targetH,
                        "draw_w_px" to drawW,
                        "draw_h_px" to drawH,
                        "draw_top_px" to drawTop,
                        "src_rect" to listOf(srcRect.left, srcRect.top, srcRect.right, srcRect.bottom),
                        "dst_rect" to listOf(dstRect.left, dstRect.top, dstRect.right, dstRect.bottom),
                        "labels_count" to (meta.optJSONArray("labels")?.length() ?: 0)
                    )
                ),
                correlationId = correlationId
            )
        }

        val labelsArr = meta.optJSONArray("labels")
        if (labelsArr != null && labelsArr.length() > 0) {
            val dpr = meta.optDouble("dpr", 1.0).toFloat()
            val sceneCssH = meta.optDouble("sceneCssH", 0.0).toFloat()
            val sceneScaleY = if (sceneCssH > 0) drawH.toFloat() / (sceneCssH * dpr) else 1f
            val fullWMeta = meta.optDouble("fullW", 0.0).toFloat()
            val sceneScaleX = if (fullWMeta > 0) drawW.toFloat() / (fullWMeta * dpr) else 1f
            val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb((255 * 0.95f).toInt(), 255, 255, 255)
                textSize = 12f * dpr * sceneScaleY
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                setShadowLayer(3f * dpr, 0f, 1f * dpr, Color.BLACK)
            }
            for (i in 0 until labelsArr.length()) {
                val l = labelsArr.getJSONObject(i)
                val text = l.optString("text", "")
                val xCss = l.optDouble("x", 0.0).toFloat()
                val yCss = l.optDouble("y", 0.0).toFloat()
                val xOut = xCss * dpr * sceneScaleX
                val yOut = drawTop + (yCss * dpr * sceneScaleY) + labelPaint.textSize
                canvas.drawText(text, xOut, yOut, labelPaint)
            }
        }

        if (BuildConfig.DEBUG && diagContext != null) {
            try {
                val diagDir = java.io.File(diagContext.filesDir, "diag")
                diagDir.mkdirs()
                val ts = System.currentTimeMillis()
                val safeTag = diagTag.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
                val fname = "render_${ts}_${requestedW}x${requestedH}_${safeTag}.png"
                java.io.FileOutputStream(java.io.File(diagDir, fname)).use { fos ->
                    out.compress(Bitmap.CompressFormat.PNG, 100, fos)
                }
                Log.i("SolarDiag", "DUMP $fname")
            } catch (t: Throwable) {
                Log.w("SolarDiag", "dump failed", t)
            }
        }

        return out
    }

    private fun decodeDataUrl(dataUrl: String): Bitmap? {
        val commaIdx = dataUrl.indexOf("base64,")
        if (commaIdx < 0) return null
        val base64 = dataUrl.substring(commaIdx + 7)
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    private class SnapshotBridge(
        val onSnapshotJson: (String) -> Unit,
        val onSnapshotError: (String) -> Unit
    ) {
        @JavascriptInterface
        fun onSnapshotJson(json: String) { onSnapshotJson.invoke(json) }
        @JavascriptInterface
        fun onSnapshotError(msg: String) { onSnapshotError.invoke(msg) }
    }
}
