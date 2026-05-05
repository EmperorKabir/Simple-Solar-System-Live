package com.livesolar.solarsystem

import android.annotation.SuppressLint
import android.app.Activity
import android.app.WallpaperInfo
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

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

            addJavascriptInterface(WallpaperPickerBridge(this@MainActivity), "WallpaperPicker")

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

    /**
     * JS-side bridge for the in-app wallpaper picker. Exposes per-surface
     * settings (home / lock) to JS and lets JS launch Android's live-wallpaper
     * preview pre-selecting our service.
     */
    class WallpaperPickerBridge(private val activity: Activity) {
        @JavascriptInterface
        fun getSettings(): String {
            val home = SurfaceSettings(
                activity, SurfaceSettings.HOME_WALLPAPER_NAMESPACE,
                SurfaceSettings.DEFAULT_HOME_OFFSET_Y
            )
            val lock = SurfaceSettings(
                activity, SurfaceSettings.LOCK_WALLPAPER_NAMESPACE,
                SurfaceSettings.DEFAULT_LOCK_OFFSET_Y
            )
            return JSONObject()
                .put("home", JSONObject()
                    .put("offsetY", home.offsetY)
                    .put("tilt", home.tilt)
                    .put("labels", home.labelsEnabled)
                    .put("hidePluto", home.hidePluto))
                .put("lock", JSONObject()
                    .put("offsetY", lock.offsetY)
                    .put("tilt", lock.tilt)
                    .put("labels", lock.labelsEnabled)
                    .put("hidePluto", lock.hidePluto))
                .toString()
        }

        @JavascriptInterface
        fun saveSettings(target: String, offsetY: Float, tilt: Float, labels: Boolean, hidePluto: Boolean) {
            val (ns, def) = when (target) {
                "home" -> SurfaceSettings.HOME_WALLPAPER_NAMESPACE to SurfaceSettings.DEFAULT_HOME_OFFSET_Y
                "lock" -> SurfaceSettings.LOCK_WALLPAPER_NAMESPACE to SurfaceSettings.DEFAULT_LOCK_OFFSET_Y
                else -> return
            }
            SurfaceSettings(activity, ns, def).apply {
                this.offsetY = offsetY
                this.tilt = tilt
                this.labelsEnabled = labels
                this.hidePluto = hidePluto
            }
        }

        @JavascriptInterface
        fun applyWallpaper(target: String): Boolean {
            val cls = when (target) {
                "home" -> SolarSystemHomeWallpaperService::class.java
                "lock" -> SolarSystemLockWallpaperService::class.java
                else -> return false
            }
            val targetComponent = ComponentName(activity, cls)
            // If our service is already the active wallpaper for this surface,
            // skip Samsung's system preview entirely. Settings have already
            // been persisted by saveSettings; the wallpaper service polls
            // SharedPreferences via currentParams() vs lastParams in
            // onVisibilityChanged and re-renders on next visibility cycle.
            // Returns true → JS dismisses our modal without launching system UI.
            if (isAlreadyBound(target, targetComponent)) {
                val msg = if (target == "home") "Home screen changed" else "Lock screen changed"
                activity.runOnUiThread {
                    Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show()
                }
                return true
            }
            val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
                putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    targetComponent
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.runOnUiThread {
                try {
                    activity.startActivity(intent)
                    // Optimistically mark as bound for the pre-API-34 fallback
                    // path. If the user cancels the system preview, the worst
                    // outcome is we skip the preview next time (still works
                    // because the wallpaper isn't ours and the apply intent
                    // re-fires on next 'Set'). API 34+ uses real WallpaperInfo
                    // so this flag is just a fallback.
                    markBound(target)
                } catch (_: Throwable) {
                    try { activity.startActivity(
                        Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    ) } catch (_: Throwable) {}
                }
            }
            return false
        }

        // Detect whether our service is the currently active live wallpaper
        // for the given target surface.
        //
        // Direct query: home uses WallpaperManager.getWallpaperInfo() (API 14+);
        // lock requires WallpaperManager.getWallpaperInfo(int) which is only
        // reliably available on API 34+ via reflection.
        //
        // SharedPreferences fallback: every successful direct query updates
        // the cache so subsequent calls can fall back to it when Samsung's
        // One UI returns null from the direct API (observed on Z Fold 6).
        // Plus markBound writes to the cache after every applyWallpaper
        // intent, so users who reach the system preview at least once can
        // skip it on subsequent taps even if direct query is unreliable.
        private fun isAlreadyBound(target: String, expected: ComponentName): Boolean {
            val wm = WallpaperManager.getInstance(activity)
            val direct: ComponentName? = when {
                target == "home" -> wm.wallpaperInfo?.component
                Build.VERSION.SDK_INT >= 34 -> try {
                    val method = WallpaperManager::class.java.getMethod("getWallpaperInfo", Int::class.javaPrimitiveType)
                    (method.invoke(wm, /* FLAG_LOCK */ 2) as? WallpaperInfo)?.component
                } catch (_: Throwable) { null }
                else -> null
            }
            val prefs = activity.getSharedPreferences("slss.bind_state", Context.MODE_PRIVATE)
            if (direct != null) {
                val bound = (direct == expected)
                prefs.edit().putBoolean("bound_$target", bound).apply()
                return bound
            }
            return prefs.getBoolean("bound_$target", false)
        }

        private fun markBound(target: String) {
            activity.getSharedPreferences("slss.bind_state", Context.MODE_PRIVATE)
                .edit().putBoolean("bound_$target", true).apply()
        }
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
