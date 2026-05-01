package com.livesolar.solarsystem

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : Activity() {

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Draw behind system bars so the WebView fills the full display.
        // The HTML reads safe-area-inset-* via CSS env() and offsets its UI
        // accordingly, so content stays clear of the status bar / cutouts.
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
            // Allow CSS env(safe-area-inset-*) to receive non-zero values
            // by letting the WebView extend under system bars.
            fitsSystemWindows = false

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = WebChromeClient()

            loadUrl("https://appassets.androidplatform.net/assets/index.html")
        }

        // Forward real system-bar insets to the WebView via CSS variables,
        // because some Android WebView versions report 0 for env(safe-area-*).
        ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
            val sysBars = insets.getInsets(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
            )
            val density = resources.displayMetrics.density
            val topDp    = sysBars.top    / density
            val rightDp  = sysBars.right  / density
            val bottomDp = sysBars.bottom / density
            val leftDp   = sysBars.left   / density
            val js = """
                (function(){
                  var r = document.documentElement.style;
                  r.setProperty('--safe-top',    '${topDp}px');
                  r.setProperty('--safe-right',  '${rightDp}px');
                  r.setProperty('--safe-bottom', '${bottomDp}px');
                  r.setProperty('--safe-left',   '${leftDp}px');
                })();
            """.trimIndent()
            (v as WebView).evaluateJavascript(js, null)
            insets
        }

        setContentView(webView)
    }
}
