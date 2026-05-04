package com.livesolar.solarsystem

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Offscreen WebView → Bitmap helper.
 *
 * Three.js uses WebGL, which webView.draw(canvas) cannot capture (that
 * call only captures the WebView's view hierarchy, not WebGL output).
 * Instead we use a JS bridge:
 *   1. JS renders the scene (with preserveDrawingBuffer enabled in
 *      surface mode), calls canvas.toDataURL('image/png'), and posts
 *      the data-URL to window.SnapshotBridge.onSnapshot.
 *   2. We decode the base64 PNG into a Bitmap on the Kotlin side.
 *
 * Must be invoked on the main looper. Hardware acceleration left ON
 * because WebGL requires it.
 */
object WebViewBitmapRenderer {
    private const val OVERALL_TIMEOUT_MS = 8000L

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

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()

        val handler = Handler(Looper.getMainLooper())
        var done = false
        var wv: WebView? = null

        val bridge = SnapshotBridge { dataUrl ->
            if (done) return@SnapshotBridge
            done = true
            handler.post {
                try {
                    val bm = decodeDataUrl(dataUrl, widthPx, heightPx)
                    android.util.Log.d("SLSS", "snapshot bitmap=${bm?.width}x${bm?.height} requested ${widthPx}x${heightPx}")
                    onResult(bm)
                } catch (t: Throwable) {
                    onResult(null)
                } finally {
                    try { wv?.destroy() } catch (_: Throwable) {}
                }
            }
        }

        wv = WebView(context.applicationContext).apply {
            measure(
                View.MeasureSpec.makeMeasureSpec(widthPx, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(heightPx, View.MeasureSpec.EXACTLY)
            )
            layout(0, 0, widthPx, heightPx)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.useWideViewPort = false
            settings.loadWithOverviewMode = false
            setBackgroundColor(Color.BLACK)
            // Hardware accel is required for WebGL — leave the WebView in its default layer mode.
            addJavascriptInterface(bridge, "SnapshotBridge")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)
            }
        }

        // Hard timeout — if JS never posts a snapshot, give up and report failure.
        handler.postDelayed({
            if (done) return@postDelayed
            done = true
            try { wv?.destroy() } catch (_: Throwable) {}
            onResult(null)
        }, OVERALL_TIMEOUT_MS)

        wv?.loadUrl("https://appassets.androidplatform.net/assets/index.html$urlParams")
    }

    private fun decodeDataUrl(dataUrl: String, widthPx: Int, heightPx: Int): Bitmap? {
        val commaIdx = dataUrl.indexOf("base64,")
        if (commaIdx < 0) return null
        val base64 = dataUrl.substring(commaIdx + 7)
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    private class SnapshotBridge(val onSnapshot: (String) -> Unit) {
        @JavascriptInterface
        fun onSnapshot(dataUrl: String) { onSnapshot.invoke(dataUrl) }
        @JavascriptInterface
        fun onSnapshotError(msg: String) { android.util.Log.e("SnapshotBridge", "JS reported: $msg") }
    }
}
