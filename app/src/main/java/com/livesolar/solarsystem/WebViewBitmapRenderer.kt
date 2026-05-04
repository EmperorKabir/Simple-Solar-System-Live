package com.livesolar.solarsystem

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Offscreen WebView → Bitmap helper.
 *
 * Loads index.html with the supplied URL params at the requested pixel
 * size, waits long enough for textures to decode + Three.js to render
 * its first frame, then captures the WebView's surface to a Bitmap and
 * destroys the WebView.
 *
 * Must be invoked on the main looper. WebView requires LAYER_TYPE_SOFTWARE
 * for draw(canvas) to work reliably across Android versions.
 */
object WebViewBitmapRenderer {
    private const val FIRST_FRAME_DELAY_MS = 1800L

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

        @Suppress("DEPRECATION")  // setLayerType deprecated for hardware accel only — software still required for offscreen draw
        val wv = WebView(context.applicationContext)
        wv.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        wv.measure(
            View.MeasureSpec.makeMeasureSpec(widthPx, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(heightPx, View.MeasureSpec.EXACTLY)
        )
        wv.layout(0, 0, widthPx, heightPx)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.settings.useWideViewPort = false
        wv.settings.loadWithOverviewMode = false
        wv.setBackgroundColor(Color.BLACK)

        val handler = Handler(Looper.getMainLooper())
        var done = false

        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String?) {
                handler.postDelayed({
                    if (done) return@postDelayed
                    done = true
                    var bm: Bitmap? = null
                    try {
                        bm = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
                        bm.eraseColor(Color.BLACK)
                        wv.draw(Canvas(bm))
                    } catch (t: Throwable) {
                        bm = null
                    } finally {
                        try { wv.destroy() } catch (_: Throwable) {}
                        onResult(bm)
                    }
                }, FIRST_FRAME_DELAY_MS)
            }
        }

        wv.loadUrl("https://appassets.androidplatform.net/assets/index.html$urlParams")
    }
}
