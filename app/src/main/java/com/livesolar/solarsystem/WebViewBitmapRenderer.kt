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
import android.os.SystemClock
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

    fun render(
        context: Context,
        widthPx: Int,
        heightPx: Int,
        urlParams: String,
        onResult: (Bitmap?) -> Unit
    ) {
        require(Looper.myLooper() == Looper.getMainLooper()) {
            "WebViewBitmapRenderer.render must be called on the main thread"
        }
        if (widthPx <= 0 || heightPx <= 0) { onResult(null); return }

        val app = context.applicationContext
        val handler = Handler(Looper.getMainLooper())
        var done = false
        val tStart = SystemClock.elapsedRealtime()
        Log.i(TAG, "SLSS_DIAG render start ${widthPx}x${heightPx} surface=${urlParams}")

        val imageReader = ImageReader.newInstance(widthPx, heightPx, PixelFormat.RGBA_8888, 2)
        val displayManager = app.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val density = app.resources.displayMetrics.densityDpi
        val virtualDisplay: VirtualDisplay = displayManager.createVirtualDisplay(
            "SolarRenderer-${System.nanoTime()}",
            widthPx, heightPx, density,
            imageReader.surface,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY
        )

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

        val cleanup: () -> Unit = {
            try { presentation.dismiss() } catch (_: Throwable) {}
            try { virtualDisplay.release() } catch (_: Throwable) {}
            try { imageReader.close() } catch (_: Throwable) {}
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(app))
            .build()

        val bridge = SnapshotBridge { json ->
            if (done) return@SnapshotBridge
            done = true
            Log.i(TAG, "SLSS_DIAG snapshot received t=${SystemClock.elapsedRealtime() - tStart}ms chars=${json.length}")
            handler.post {
                var bm: Bitmap? = null
                try {
                    bm = composeBitmap(json, widthPx, heightPx)
                } catch (t: Throwable) {
                    Log.w(TAG, "compose failed", t)
                } finally {
                    cleanup()
                    onResult(bm)
                }
            }
        }

        val wv = WebView(app)
        wv.layoutParams = ViewGroup.LayoutParams(widthPx, heightPx)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.settings.useWideViewPort = false
        wv.settings.loadWithOverviewMode = false
        wv.setBackgroundColor(Color.BLACK)
        wv.addJavascriptInterface(bridge, "SnapshotBridge")
        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
            override fun onPageFinished(view: WebView, url: String?) {
                Log.i(TAG, "SLSS_DIAG onPageFinished t=${SystemClock.elapsedRealtime() - tStart}ms")
            }
        }
        presentation.setContentView(wv)
        try { presentation.show() } catch (t: Throwable) {
            Log.w(TAG, "presentation.show failed", t)
            cleanup(); onResult(null); return
        }

        handler.postDelayed({
            if (done) return@postDelayed
            done = true
            Log.w(TAG, "SLSS_DIAG TIMEOUT t=${SystemClock.elapsedRealtime() - tStart}ms (JS bridge never fired)")
            cleanup(); onResult(null)
        }, OVERALL_TIMEOUT_MS)

        wv.loadUrl("https://appassets.androidplatform.net/assets/index.html$urlParams")
    }

    private fun composeBitmap(metaJson: String, requestedW: Int, requestedH: Int): Bitmap? {
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
        canvas.drawBitmap(sceneBitmap, srcRect, dstRect, Paint(Paint.FILTER_BITMAP_FLAG))
        sceneBitmap.recycle()

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

        return out
    }

    private fun decodeDataUrl(dataUrl: String): Bitmap? {
        val commaIdx = dataUrl.indexOf("base64,")
        if (commaIdx < 0) return null
        val base64 = dataUrl.substring(commaIdx + 7)
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    private class SnapshotBridge(val onSnapshotJson: (String) -> Unit) {
        @JavascriptInterface
        fun onSnapshotJson(json: String) { onSnapshotJson.invoke(json) }
        @JavascriptInterface
        fun onSnapshotError(msg: String) { Log.w("SolarRenderer", "JS error: $msg") }
    }
}
