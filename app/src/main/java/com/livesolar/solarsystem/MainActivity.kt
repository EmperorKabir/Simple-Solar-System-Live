package com.livesolar.solarsystem

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : Activity() {

    /** Last system-bar / cutout insets in dp; cached so we can re-inject after
     *  the page finishes loading (the inset listener fires before DOM parse). */
    private var safeTopDp    = 0f
    private var safeRightDp  = 0f
    private var safeBottomDp = 0f
    private var safeLeftDp   = 0f
    private var pageReady    = false
    private var pendingWebView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Draw behind system bars so the WebView fills the full display.
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.mediaPlaybackRequiresUserGesture = false

            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            setBackgroundColor(Color.BLACK)
            fitsSystemWindows = false

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

                override fun onPageFinished(view: WebView, url: String?) {
                    pageReady = true
                    injectSafeAreaInsets(view)
                }
            }
            // TEMP DIAG: bridge WebView console.log to logcat (tag: WebConsole)
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(cm: ConsoleMessage): Boolean {
                    Log.i("WebConsole", "${cm.message()} @ ${cm.sourceId()}:${cm.lineNumber()}")
                    return true
                }
            }

            loadUrl("https://appassets.androidplatform.net/assets/index.html")
        }

        pendingWebView = webView

        // Cache insets and re-inject every time they change.
        ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
            val sysBars = insets.getInsets(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
            )
            val density = resources.displayMetrics.density
            safeTopDp    = sysBars.top    / density
            safeRightDp  = sysBars.right  / density
            safeBottomDp = sysBars.bottom / density
            safeLeftDp   = sysBars.left   / density
            if (pageReady) injectSafeAreaInsets(v as WebView)
            insets
        }

        setContentView(webView)
    }

    private fun injectSafeAreaInsets(webView: WebView) {
        // Use plain numbers to avoid locale-dependent decimal separators.
        val js = """
            (function(){
              var r = document.documentElement.style;
              r.setProperty('--safe-top',    '${safeTopDp}px');
              r.setProperty('--safe-right',  '${safeRightDp}px');
              r.setProperty('--safe-bottom', '${safeBottomDp}px');
              r.setProperty('--safe-left',   '${safeLeftDp}px');
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }
}
